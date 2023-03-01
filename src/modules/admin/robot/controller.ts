import { Request, Response, NextFunction } from 'express';
import { BadResponse, SuccessJsonResponse, NoContentResponse, SuccessMessageResponse } from '@airbotics-core/network/responses';
import { logger } from '@airbotics-core/logger';
import { RevocationReason } from '@aws-sdk/client-acm-pca';
import { EcuTelemetry, RolloutRobotStatus } from '@prisma/client';
import { prisma } from '@airbotics-core/drivers';
import { getKeyStorageEcuKeyId } from '@airbotics-core/utils';
import { keyStorage } from '@airbotics-core/key-storage';
import { airEvent } from '@airbotics-core/events';
import { EComputedRobotStatus, EEventAction, EEventActorType, EEventResource } from '@airbotics-core/consts';
import { certificateManager } from '@airbotics-core/crypto';
import { IRobotDetailRes, IRobotRes, IEcuTelemetryRes, IRobotRolloutRes, IUpdateRobotDetailsBody } from '@airbotics-types';
import { EcuStatus } from '@prisma/client';


const computeRobotStatus = (ecu_status: EcuStatus[]): EComputedRobotStatus => {
    if (ecu_status.every(status => status === EcuStatus.installation_completed)) {
        return EComputedRobotStatus.Updated;
    }
    else if (ecu_status.includes(EcuStatus.installation_failed || EcuStatus.download_failed)) {
        return EComputedRobotStatus.Failed;
    }
    else {
        return EComputedRobotStatus.Updating;
    }
}

/**
 * Lists all robots in requesters team. 
 */
export const listRobots = async (req: Request, res: Response, next: NextFunction) => {

    const teamID = req.headers['air-team-id'];

    // get robots
    const robots = await prisma.robot.findMany({
        where: {
            team_id: teamID
        },
        orderBy: {
            created_at: 'desc'
        },
        include: {
            ecus: {
                select: { status: true },
            },
            _count: {
                select: { groups: true }
            }
        }
    });



    const robotsSanitised: IRobotRes[] = robots.map(robot => ({
        id: robot.id,
        name: robot.name,
        status: computeRobotStatus(robot.ecus.map(ecu => ecu.status)),
        group_count: robot._count.groups,
        created_at: robot.created_at,
        last_seen_at: robot.last_seen_at
    }));


    logger.info('A user read a list of the robots');
    return new SuccessJsonResponse(res, robotsSanitised);

}



/**
 * Get detailed info about a robot in a team.
 */
export const getRobot = async (req: Request, res: Response, next: NextFunction) => {

    const teamID = req.headers['air-team-id']!;
    const robotID = req.params.robot_id;

    const robot = await prisma.robot.findUnique({
        where: {
            team_id_id: {
                team_id: teamID,
                id: robotID
            }
        },
        include: {
            ecus: {
                orderBy: {
                    created_at: 'desc'
                },
                include: { installed_image: true }
            },
            groups: {
                include: {
                    group: {
                        select: { id: true, name: true }
                    }
                }
            },
            robot_manifests: {
                take: 10,
                orderBy: {
                    created_at: 'desc'
                }
            },
            certificates: {
                orderBy: {
                    created_at: 'desc'
                }
            },
            network_reports: {
                take: 1,
                orderBy: {
                    created_at: 'desc'
                }
            }
        }
    });

    if (!robot) {
        logger.warn('could not get info about robot because it or the team does not exist');
        return new BadResponse(res, 'Unable to get robot details');
    }

    const robotSanitised: IRobotDetailRes = {
        id: robot.id,
        name: robot.name,
        description: robot.description,
        last_seen_at: robot.last_seen_at,
        created_at: robot.created_at,
        updated_at: robot.updated_at,
        status: computeRobotStatus(robot.ecus.map(ecu => ecu.status)),
        agent_version: robot.agent_version,
        ecus_registered: robot.ecus_registered,
        groups: robot.groups.map(grp => ({ id: grp.group_id, name: grp.group.name })),
        robot_manifests: robot.robot_manifests.map(manifest => ({
            id: manifest.id,
            valid: manifest.valid,
            created_at: manifest.created_at
        })),
        ecus: robot.ecus.map(ecu => ({
            id: ecu.id,
            primary: ecu.primary,
            status: ecu.status,
            hw_id: ecu.hwid,
            installed_image: ecu.installed_image ? {
                id: ecu.installed_image.id,
                name: ecu.installed_image.name,
                format: ecu.installed_image.format,
                size: ecu.installed_image.size
            } : undefined,
            created_at: ecu.created_at,
            updated_at: ecu.updated_at,
        })),
        certificates: robot.certificates.map(cert => ({
            id: cert.id,
            created_at: cert.created_at,
            expires_at: cert.expires_at,
            status: cert.status,
            serial: cert.serial,
            revoked_at: cert.revoked_at
        })),
        latest_network_report: robot.network_reports.length === 0 ? undefined : {
            created_at: robot.network_reports[0].created_at,
            hostname: robot.network_reports[0].hostname,
            local_ipv4: robot.network_reports[0].local_ipv4,
            mac: robot.network_reports[0].mac
        }
    };

    logger.info('a user has read a robots detail');
    return new SuccessJsonResponse(res, robotSanitised);

}



/**
 * Update a robots name and description
 */
export const updateRobotDetails = async (req: Request, res: Response, next: NextFunction) => {

    const oryID = req.oryIdentity!.traits.id;
    const teamID = req.headers['air-team-id']!;
    const robotID = req.params.robot_id;

    const {
        name,
        description
    } = req.body as IUpdateRobotDetailsBody;

    await prisma.robot.update({
        where: {
            team_id_id: {
                team_id: teamID,
                id: robotID
            }
        },
        data: {
            name,
            description
        }
    });

    airEvent.emit({
        resource: EEventResource.Robot,
        action: EEventAction.DetailsUpdated,
        actor_type: EEventActorType.User,
        actor_id: oryID,
        team_id: teamID,
        meta: {
            robot_id: robotID,
            name,
            description
        }
    });

    logger.info('a user has updated a robots detail');
    return new SuccessMessageResponse(res, 'robot has been updated');

}



/**
 * Delete a robot.
 */
export const deleteRobot = async (req: Request, res: Response, next: NextFunction) => {

    const oryID = req.oryIdentity!.traits.id;
    const teamID = req.headers['air-team-id']!;
    const robotID = req.params.robot_id;

    // try delete robot
    try {

        const robot = await prisma.robot.delete({
            where: {
                team_id_id: {
                    team_id: teamID,
                    id: robotID
                }
            },
            include: {
                ecus: true,
                certificates: true
            }
        });

        // delete ecu keys for this robot
        for (const ecu of robot.ecus) {
            await keyStorage.deleteKeyPair(getKeyStorageEcuKeyId(teamID, ecu.id));
        }

        // revoke certificate
        await certificateManager.revokeCertificate(robot.certificates[0].serial, RevocationReason.PRIVILEGE_WITHDRAWN);

        airEvent.emit({
            resource: EEventResource.Robot,
            action: EEventAction.Deleted,
            actor_type: EEventActorType.User,
            actor_id: oryID,
            team_id: teamID,
            meta: {
                robot_id: robot.id
            }
        });

        logger.info('deleted a robot');
        return new NoContentResponse(res, 'The robot has been deleted')

    } catch (error) {
        // catch deletion failure error code
        // someone has tried to delete a robot that does not exist in this team, return 400
        if (error.code === 'P2025') {
            logger.warn('could not delete a robot because it does not exist');
            return new BadResponse(res, 'Could not delete the robot');
        }
        // otherwise we dont know what happened so re-throw the errror and let the
        // general error catcher return it as a 500
        throw error;
    }

}


/**
 * List the groups this robot is in.
 */
export const listRobotGroups = async (req: Request, res: Response, next: NextFunction) => {

    const oryID = req.oryIdentity!.traits.id;
    const teamID = req.headers['air-team-id']!;
    const robotID = req.params.robot_id;

    // const {
    //     skip,
    //     take
    // } = req.query;

    try {

        const robot = await prisma.robot.findUnique({
            where: {
                team_id_id: {
                    id: robotID,
                    team_id: teamID
                }
            },
            include: {
                groups: {
                    include: { group: true },
                    orderBy: {
                        created_at: 'desc'
                    },
                    // skip: skip ? Number(skip) : undefined,
                    // take: take ? Number(take) : undefined
                },
            }
        })

        if (!robot) {
            logger.error('A user tried to list groups for a robot they dont own or doesnt exist');
            return new BadResponse(res, 'That robot could not be found');
        }

        const sanitisedrobotGroups = robot.groups.map(robotGroup => ({
            group_id: robotGroup.group_id,
            name: robotGroup.group.name,
            created_at: robotGroup.group.created_at
        }));

        logger.info('A user read a list of a robots groups');
        return new SuccessJsonResponse(res, sanitisedrobotGroups);

    } catch (error) {
        next(error);
    }

}


/**
 * List the rollouts a robot is associated with
 */
export const listRobotRollouts = async (req: Request, res: Response, next: NextFunction) => {

    const {
        skip,
        take
    } = req.query;

    const teamId = req.headers['air-team-id']!;
    const robotId = req.params.robot_id;

    const robotRollouts = await prisma.rolloutRobot.findMany({
        where: {
            robot_id: robotId
        },
        include: {
            rollout: {
                select: { id: true, name: true, status: true }
            }
        },
        skip: skip ? Number(skip) : undefined,
        take: take ? Number(take) : undefined
    })

    const rolloutRobotSanitised: IRobotRolloutRes[] = robotRollouts.map(botRollout => ({
        id: botRollout.id,
        status: botRollout.status,
        created_at: botRollout.created_at,
        rollout: botRollout.rollout
    }))


    logger.info('A user read a page of robot rollouts');
    return new SuccessJsonResponse(res, rolloutRobotSanitised);

}


/**
 * Get telemetry for a robot.
 */
export const listRobotTelemetry = async (req: Request, res: Response, next: NextFunction) => {

    const {
        skip,
        take
    } = req.query;

    const teamId = req.headers['air-team-id']!;
    const robotId = req.params.robot_id;

    const ecuTele = await prisma.ecuTelemetry.findMany({
        where: {
            ecu: {
                robot_id: robotId
            },
            team_id: teamId
        },
        include: {
            ecu: { select: { hwid: true } }
        },
        orderBy: {
            created_at: 'desc'
        },
        skip: skip ? Number(skip) : undefined,
        take: take ? Number(take) : undefined
    })

    const ecuTeleSanitised: IEcuTelemetryRes[] = ecuTele.map(tele => ({
        id: tele.id,
        device_time: tele.device_time,
        event_type: tele.event_type,
        success: tele.success,
        ecu: {
            id: tele.ecu_id,
            hw_id: tele.ecu.hwid
        }
    }));

    logger.info('A user read a page of ecu telemetry');
    return new SuccessJsonResponse(res, ecuTeleSanitised);
}


/**
 * Delete telemetry for a robot.
 */
export const deleteRobotTelemetry = async (req: Request, res: Response, next: NextFunction) => {

    const oryID = req.oryIdentity!.traits.id;
    const teamId = req.headers['air-team-id']!;
    const robotId = req.params.robot_id;

    await prisma.ecuTelemetry.deleteMany({
        where: {
            ecu: {
                robot_id: robotId
            },
            team_id: teamId
        }
    });

    airEvent.emit({
        resource: EEventResource.RobotTelemetry,
        action: EEventAction.Deleted,
        actor_type: EEventActorType.User,
        actor_id: oryID,
        team_id: teamId,
        meta: {
            robot_id: robotId
        }
    });

    logger.info('a user has deleted telemetry for a robot');
    return new SuccessMessageResponse(res, 'You have deleted telemetry for that robot');
}

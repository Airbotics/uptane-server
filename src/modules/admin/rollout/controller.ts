import { Request, Response, NextFunction } from 'express';
import { BadResponse, SuccessJsonResponse } from '@airbotics-core/network/responses';
import { logger } from '@airbotics-core/logger';
import { Ecu, Robot, Rollout, RolloutStatus } from '@prisma/client';
import { RolloutTargetType } from '@airbotics-core/consts';
import { SuccessMessageResponse } from '../../../core/network/responses';
import { prisma } from '@airbotics-core/drivers';
import { auditEvent } from '@airbotics-core/events';
import { EEventAction, EEventActorType, EEventResource } from '@airbotics-core/consts';
import { IRolloutAffectedBotRes, IRolloutDetailRes, IRolloutRes, ICreateRolloutBody } from '@airbotics-types';
import { setEnvironmentData } from 'worker_threads';


/**
 * Create a rollout.
 * 
 * @description At a high level a rollout is a map between ecu hw_id(s) and built
 * compatible image(s). Creating a rollout will store which images are due to be 
 * installed on which ecus with mathcing hw_ids given a a list of targeted robots. 
 * The state of the rollout on each affected device is stored as well as the overall 
 * state of the rollout. This endpoint leaves the rollout in a 'pending' state, the
 * launchRollout endpoint must be called before the updates begin to be applied to
 * affected robots 
 */
export const createRollout = async (req: Request, res: Response) => {

    const body: ICreateRolloutBody = req.body;

    const teamId = req.headers['air-team-id']!;
    const oryId = req.oryIdentity!.traits.id;

    try {

        const createdRollout: Rollout = await prisma.$transaction(async tx => {

            //Create the rollout
            const rollout = await tx.rollout.create({
                data: {
                    team_id: teamId,
                    name: body.name,
                    description: body.description,
                    target_type: body.targeted_robots.type,
                    status: RolloutStatus.prepared
                }
            });

            //Add the hw_id to image_id map for the rollout
            await tx.rolloutHardwareImage.createMany({
                data: body.hwid_img_map.map(elem => ({
                    rollout_id: rollout.id,
                    hw_id: elem.hw_id,
                    image_id: elem.img_id

                }))
            });

            //Determine the potentially affected bot_ids and their corresponding ecu_ids
            let potentiallyAffectedBots: { robot_id: string, ecu_ids: string[] }[] = [];

            if (body.targeted_robots.type === RolloutTargetType.selected_bots) {

                const robots = await tx.robot.findMany({
                    where: {
                        id: { in: body.targeted_robots.selected_bot_ids }
                    },
                    include: {
                        ecus: {
                            select: { id: true },
                            where: {
                                hwid: { in: body.hwid_img_map.map(elem => elem.hw_id) }
                            }
                        }
                    }
                });

                potentiallyAffectedBots = robots.map(robot => ({
                    robot_id: robot.id,
                    ecu_ids: robot.ecus.map(ecu => ecu.id)
                }))
            }

            else if (body.targeted_robots.type === RolloutTargetType.group) {

                const robotGroups = await tx.robotGroup.findMany({
                    where: {
                        group_id: body.targeted_robots.group_id
                    },
                    include: {
                        robot: {
                            include: {
                                ecus: {
                                    select: { id: true },
                                    where: {
                                        hwid: { in: body.hwid_img_map.map(elem => elem.hw_id) }
                                    }
                                }
                            }
                        }
                    }
                });

                potentiallyAffectedBots = robotGroups.map(botGrp => ({
                    robot_id: botGrp.robot_id,
                    ecu_ids: botGrp.robot.ecus.map(ecu => ecu.id)
                }))
            }

            else if (body.targeted_robots.type === RolloutTargetType.hw_id_match) {

                const hwIds = body.hwid_img_map.map(elem => (elem.hw_id));

                const robots = await tx.robot.findMany({
                    where: {
                        ecus: {
                            some: {
                                hwid: { in: hwIds }
                            }
                        }
                    },
                    include: {
                        ecus: {
                            select: { id: true },
                            where: {
                                hwid: { in: body.hwid_img_map.map(elem => elem.hw_id) }
                            }
                        }
                    }
                })

                potentiallyAffectedBots = robots.map(robot => ({
                    robot_id: robot.id,
                    ecu_ids: robot.ecus.map(ecu => ecu.id)
                }))
            }

            else {
                throw ('Unknown robot target type for rollout');
            }

            if (potentiallyAffectedBots.length === 0) {
                throw ('Cannot create a rollout that affects 0 robots!');
            }

            //For each of the potentially affected bots, add a RolloutRobot and n RolloutRobotEcus
            for (const bot of potentiallyAffectedBots) {
                await tx.rolloutRobot.create({
                    data: {
                        rollout_id: rollout.id,
                        robot_id: bot.robot_id,
                        ecus: {
                            createMany: {
                                data: bot.ecu_ids.map(id => ({
                                    ecu_id: id
                                }))
                            }
                        }
                    }
                })
            }

            return rollout;

        });


        auditEvent.emit({
            resource: EEventResource.Rollout,
            action: EEventAction.Created,
            actor_type: EEventActorType.User,
            actor_id: oryId,
            team_id: teamId,
            meta: {
                rollout_id: createdRollout.id,
                name: createdRollout.name
            }
        });

        const rolloutSantised: IRolloutRes = {
            id: createdRollout.id,
            name: createdRollout.name,
            description: createdRollout.description,
            status: createdRollout.status,
            created_at: createdRollout.created_at,
            updated_at: createdRollout.updated_at
        };

        logger.info('created rollout');

        return new SuccessJsonResponse(res, rolloutSantised);

    } catch (e) {
        return new BadResponse(res, e);
    }

}



/**
 * Launches a rollout
 * 
 * @description This will set the rollout status to 'launched' meaning
 * the next time the rollout worker runs it will process the rollout and 
 * generate new director targets metadata for all the affected devices.
 * As the affected robots attempt to update themselves, the various status 
 * fields will be updated.
 * 
 */
export const launchRollout = async (req: Request, res: Response) => {

    const oryId = req.oryIdentity!.traits.id;
    const rolloutId = req.params.rollout_id;
    const teamId = req.headers['air-team-id']!;

    try {
        const rollout = await prisma.rollout.update({
            data: {
                status: 'launched'
            },
            where: {
                id_team_id: {
                    id: rolloutId,
                    team_id: teamId
                }
            }
        });
        auditEvent.emit({
            resource: EEventResource.Rollout,
            action: EEventAction.Launched,
            actor_type: EEventActorType.User,
            actor_id: oryId,
            team_id: teamId,
            meta: {
                rollout_id: rollout.id,
                name: rollout.name
            }
        });
    }
    catch (e) {
        logger.warn('could not launch the rollout, either it does not exist or belongs to another team');
        return new BadResponse(res, 'Unable to launch rollout')
    }

    logger.info('a user has launched a rollout');
    return new SuccessMessageResponse(res, rolloutId);
}




/**
 * Lists rollouts
 * 
 * @description This will return a list of rollouts.
 * 
 */
export const listRollouts = async (req: Request, res: Response) => {

    const teamId = req.headers['air-team-id'];
    const { skip, take } = req.query;

    const rollouts = await prisma.rollout.findMany({
        where: {
            team_id: teamId
        },
        orderBy: {
            created_at: 'desc'
        },
        skip: skip ? Number(skip) : undefined,
        take: take ? Number(take) : undefined
    })

    const rolloutSanitised: IRolloutRes[] = rollouts.map(rollout => ({
        id: rollout.id,
        name: rollout.name,
        description: rollout.description,
        status: rollout.status,
        created_at: rollout.created_at,
        updated_at: rollout.updated_at
    }))

    logger.info('A user read a list of rollouts');

    return new SuccessJsonResponse(res, rolloutSanitised);
}



/**
 * Get detailed information about one rollout
 * 
 * @description This will return detailed information about a given 
 * rollout, including the status of each robot in the rollout
 * 
 */
export const getRollout = async (req: Request, res: Response) => {

    const rolloutId = req.params.rollout_id;
    const teamId = req.headers['air-team-id']!;

    const rollout = await prisma.rollout.findUnique({
        where: {
            id_team_id: {
                id: rolloutId,
                team_id: teamId
            }
        },
        include: {
            robots: {
                include: {
                    robot: {
                        select: { id: true, name: true }
                    },
                    ecus: {
                        include: { ecu: true }
                    }
                }
            },
            hw_imgs: {
                include: {
                    image: { select: { id: true, target_id: true}}
                 }
            }
        }
    })

    if (!rollout) {
        logger.warn('could not get rollout details, either it does not exist or belongs to another team');
        return new BadResponse(res, 'Unable to get rollout details');
    }

    const imgHelper = (hwId: string) => {
        const image = rollout.hw_imgs.find(img => img.hw_id === hwId)!.image
        if(image) {
            return {id: image.id, target_id: image.target_id};
        }
    }

    const rolloutSanitised: IRolloutDetailRes = {
        id: rollout.id,
        name: rollout.name,
        description: rollout.description,
        status: rollout.status,
        target_type: rollout.target_type,
        created_at: rollout.created_at,
        updated_at: rollout.updated_at,
        robots: rollout.robots.map(rolloutBot => ({
            id: rolloutBot.robot_id,
            name: rolloutBot.robot ? rolloutBot.robot.name : null,
            status: rolloutBot.status,
            ecus: rolloutBot.ecus.map(rolloutEcu => ({
                id: rolloutEcu.ecu_id!,
                status: rolloutEcu.status,
                hw_id: rolloutEcu.ecu ? rolloutEcu.ecu.hwid : 'unknown',
                image: imgHelper(rolloutEcu.ecu!.hwid)
            }))
        }))
    };

    logger.info('A user read a rollout detail');
    return new SuccessJsonResponse(res, rolloutSanitised);
}






type AffectedRobot = (Robot & {
    ecus: (Ecu & {
        installed_image: {
            name: string;
        } | null;
    })[];
})

const computeAffectedHelper = (body: ICreateRolloutBody, robots: AffectedRobot[]): IRolloutAffectedBotRes[] => {

    return robots.map(bot => ({
        id: bot.id,
        name: bot.id,    //todo change to name
        ecus_affected: bot.ecus
            .filter(ecu => body.hwid_img_map.flatMap(elem => elem.hw_id).includes(ecu.hwid))
            .map(ecu => ({
                id: ecu.id,
                hwid: ecu.hwid,
                update_from: ecu.installed_image ? ecu.installed_image.name : 'Factory image'
            }))
    }))
}


export const computeAffected = async (req: Request, res: Response) => {

    const body: ICreateRolloutBody = req.body;

    const teamId = req.headers['air-team-id']!;

    // rollout is targeting a group
    if (body.targeted_robots.type === RolloutTargetType.group) {

        const robotsInGroup = await prisma.robotGroup.findMany({
            where: {
                group_id: body.targeted_robots.group_id,
                team_id: teamId
            },
            include: {
                robot: {
                    include: {
                        ecus: {
                            include: {
                                installed_image: { select: { name: true } }
                            }
                        }
                    }
                }
            }
        });

        const affected = computeAffectedHelper(body, robotsInGroup.map(robotGrp => robotGrp.robot))
        return new SuccessJsonResponse(res, affected);
    }

    // rollout is targeting matching hwids
    else if (body.targeted_robots.type === RolloutTargetType.hw_id_match) {

        const robotsWithHwId = await prisma.robot.findMany({
            where: {
                ecus: {
                    some: {
                        hwid: { in: body.hwid_img_map.flatMap(elem => elem.hw_id) }
                    }
                }
            },
            include: {
                ecus: {
                    include: {
                        installed_image: { select: { name: true } }
                    }
                }
            }
        })

        const affected = computeAffectedHelper(body, robotsWithHwId)
        return new SuccessJsonResponse(res, affected);
    }

    //rollout is targeting selected robots
    else {

        const selectedRobots = await prisma.robot.findMany({
            where: {
                id: {
                    in: body.targeted_robots.selected_bot_ids
                }
            },
            include: {
                ecus: {
                    include: {
                        installed_image: { select: { name: true } }
                    }
                }
            }
        })

        const affected = computeAffectedHelper(body, selectedRobots)
        return new SuccessJsonResponse(res, affected);
    }
}

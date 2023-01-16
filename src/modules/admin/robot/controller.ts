import { Request, Response, NextFunction } from 'express';
import { BadResponse, SuccessJsonResponse, NoContentResponse } from '@airbotics-core/network/responses';
import { logger } from '@airbotics-core/logger';
import prisma from '@airbotics-core/drivers/postgres';
import { getKeyStorageEcuKeyId } from '@airbotics-core/utils';
import { keyStorage } from '@airbotics-core/key-storage';


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
        }
    });
    
    const robotsSanitised = robots.map(robot => ({
        id: robot.id,
        created_at: robot.created_at,
        updated_at: robot.updated_at
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
                }
            },
            robot_manifests: {
                take: 10,
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

    const robotSanitised = {
        id: robot.id,
        created_at: robot.created_at,
        updated_at: robot.updated_at,
        robot_manifests: robot.robot_manifests.map(manifest => ({
            id: manifest.id,
            created_at: manifest.created_at
        })),
        ecus: robot.ecus.map(ecu => ({
            id: ecu.id,
            created_at: ecu.created_at,
            updated_at: ecu.updated_at,
        }))
    };

    logger.info('A user read a robots detail');
    return new SuccessJsonResponse(res, robotSanitised);

}



/**
 * Delete a robot
 */
export const deleteRobot = async (req: Request, res: Response, next: NextFunction) => {

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
                ecus: true
            }
        });

        // deleta ecu keys for this robot
        for(const ecu of robot.ecus) {
            await keyStorage.deleteKeyPair(getKeyStorageEcuKeyId(teamID, ecu.id));
        }

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

    const {
        skip,
        take
    } = req.query;

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
                    skip: skip ? Number(skip) : undefined,
                    take: take ? Number(take) : undefined
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
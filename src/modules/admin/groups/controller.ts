import e, { Request, Response, NextFunction } from 'express';
import { BadResponse, SuccessJsonResponse, NoContentResponse } from '@airbotics-core/network/responses';
import { logger } from '@airbotics-core/logger';
import prisma from '@airbotics-core/drivers/postgres';
import { IGroup, IGroupRobot } from '@airbotics-types';
import { auditEventEmitter } from '@airbotics-core/events';



/**
 * Create new group in requesters team. 
 */
export const createGroup = async (req: Request, res: Response, next: NextFunction) => {

    const oryID = req.oryIdentity!.traits.id;
    const teamID = req.headers['air-team-id']!;

    const {
        name,
        description,
        robotIDs
    } = req.body;

    try {


        const group = await prisma.group.create({
            data: {
                name,
                description,
                team_id: teamID,
                robots: {
                    createMany: {
                        data: robotIDs.map((id: string) => ({
                            robot_id: id
                        }))
                    }
                }
            }
        });

        const sanitisedGroup: IGroup = {
            id: group.id,
            name: group.name,
            description: group.description,
            num_robots: robotIDs.length,
            created_at: group.created_at
        }

        auditEventEmitter.emit({
            actor_id: oryID,
            action: 'create_group',
            team_id: teamID
        })

        logger.info('A user has created a new group.');

        return new SuccessJsonResponse(res, sanitisedGroup);

    } catch (error) {
        next(error);
    }
}



/**
 * Lists all groups in requesters team. 
 */
export const listGroups = async (req: Request, res: Response, next: NextFunction) => {

    const teamID = req.headers['air-team-id'];

    try {

        const groups = await prisma.group.findMany({
            where: {
                team_id: teamID
            },
            orderBy: {
                created_at: 'desc'
            },
            include: {
                _count: {
                    select: { robots: true }
                }
            }
        });

        const sanitisedGroups: IGroup[] = groups.map(group => ({
            id: group.id,
            name: group.name,
            description: group.description,
            num_robots: group._count.robots,
            created_at: group.created_at,
        }));

        logger.info('A user read a list of groups.');
        return new SuccessJsonResponse(res, sanitisedGroups);

    } catch (error) {
        next(error);
    }

}



/**
 * Get detailed info about a group in requesters team.
 */
export const getGroup = async (req: Request, res: Response, next: NextFunction) => {

    const teamID = req.headers['air-team-id']!;
    const groupID = req.params.group_id;

    try {

        const group = await prisma.group.findUnique({
            where: {
                id_team_id: {
                    id: groupID,
                    team_id: teamID
                }
            },
            include: {
                _count: {
                    select: { robots: true }
                }
            }
        });

        if (!group) {
            logger.error('A user tried to get a group that does not exist');
            return new BadResponse(res, 'Cannot get this group.');
        }

        const sanitisedGroup: IGroup = {
            id: group.id,
            name: group.name,
            description: group.description,
            num_robots: group._count.robots,
            created_at: group.created_at
        };

        logger.info('A user read a groups details.');
        return new SuccessJsonResponse(res, sanitisedGroup);

    } catch (error) {
        next(error);
    }
}




/**
 * Update info about a group in requesters team.
*/
export const updateGroup = async (req: Request, res: Response, next: NextFunction) => {

    const oryID = req.oryIdentity!.traits.id;
    const teamID = req.headers['air-team-id']!;
    const groupID = req.params.group_id;

    const {
        name,
        description
    } = req.body;

    try {

        const updatedGroup = await prisma.group.update({
            where: {
                id_team_id: {
                    id: groupID,
                    team_id: teamID
                }
            },
            data: {
                name,
                description
            },
            include: {
                _count: {
                    select: { robots: true }
                }
            }
        });

        auditEventEmitter.emit({
            actor_id: oryID,
            action: 'update_group',
            team_id: teamID
        })

        const sanitisedgroup: IGroup = {
            id: updatedGroup.id,
            name: updatedGroup.name,
            description: updatedGroup.description,
            num_robots: updatedGroup._count.robots,
            created_at: updatedGroup.created_at
        };

        logger.info('A user has updated group.');
        return new SuccessJsonResponse(res, sanitisedgroup);

    } catch (error) {
        next(error);
    }
}




/**
 * Delete group in requesters team.
*/
export const deleteGroup = async (req: Request, res: Response, next: NextFunction) => {

    const oryID = req.oryIdentity!.traits.id;
    const teamID = req.headers['air-team-id']!;
    const groupID = req.params.group_id;

    try {

        const group = await prisma.group.findUnique({
            where: {
                id_team_id: {
                    id: groupID,
                    team_id: teamID
                }
            },
            include: {
                _count: {
                    select: { robots: true }
                }
            }
        });

        if (!group) {
            logger.error('A user tried to delete a group that does not exist');
            return new BadResponse(res, 'That group could not be found');
        }

        if (group._count.robots !== 0) {
            logger.error('A user tried to delete a group that was associated with one or more robots');
            return new BadResponse(res, 'This group has robots in it, please remove them first.');
        }


        await prisma.group.delete({
            where: {
                id: groupID
            }
        });

        auditEventEmitter.emit({
            actor_id: oryID,
            action: 'delete_group',
            team_id: teamID
        })

        logger.info('A user has deleted a group for one of their teams.');
        return new NoContentResponse(res, 'That group has been deleted.');

    } catch (error) {
        next(error);
    }
}



/**
 * List robots in a group in requesters team.
 */
export const listRobotsInGroup = async (req: Request, res: Response, next: NextFunction) => {

    const oryID = req.oryIdentity!.traits.id;
    const teamID = req.headers['air-team-id']!;
    const groupID = req.params.group_id;

    const {
        skip,
        take
    } = req.query;

    try {

        const group = await prisma.group.findUnique({
            where: {
                id_team_id: {
                    id: groupID,
                    team_id: teamID
                }
            }
        });

        if (!group) {
            logger.error('A user tried to list robots in a group they arent in or that doesnt exist');
            return new BadResponse(res, 'That group could not be found');
        }

        const groupRobots = await prisma.robotGroup.findMany({
            where: {
                group_id: groupID
            },
            include: {
                robot: {
                    include: {
                        ecus: {
                            select: {
                                id: true,
                                hwid: true,
                            }
                        }
                    }
                }
            },
            orderBy: {
                created_at: 'desc'
            },
            skip: skip ? Number(skip) : undefined,
            take: take ? Number(take) : undefined
        });

        const sanitisedGroupRobots: IGroupRobot[] = groupRobots.map(groupRobot => ({
            robot_id: groupRobot.robot_id,
            created_at: groupRobot.created_at,
            ecus: groupRobot.robot.ecus.map(ecu => ({
                id: ecu.id,
                hwid: ecu.hwid,
            }))
        }));

        logger.info('A user read a list of a groups robots.');
        return new SuccessJsonResponse(res, sanitisedGroupRobots);

    } catch (error) {
        next(error);
    }

}




/**
 * Add robot to a group in requesters team.
 * 
 * The requester could potentially spoof the robotID or groupID, to try and act on a group
 * or robot in a team not belonging to them so we need to check there is a robot and group 
 * with the ids provided in their team
 */
export const addRobotToGroup = async (req: Request, res: Response, next: NextFunction) => {

    const oryID = req.oryIdentity!.traits.id;
    const teamID = req.headers['air-team-id']!;
    const groupID = req.params.group_id;

    const {
        robot_id
    } = req.body;

    try {

        const robot = await prisma.robot.findUnique({
            where: {
                team_id_id: {
                    id: robot_id,
                    team_id: teamID
                }
            }
        });

        const group = await prisma.group.findUnique({
            where: {
                id_team_id: {
                    id: groupID,
                    team_id: teamID
                }
            }
        });

        if (!robot || !group) {
            logger.error('A user tried to add a robor to a group, that either doesnt exist or isnt in their team');
            return new BadResponse(res, 'Cannot add robot to this group.');
        }

        const groupRobot = await prisma.robotGroup.create({
            data: {
                team_id: teamID,
                robot_id: robot_id,
                group_id: groupID
            },
            include: {
                robot: {
                    include: {
                        ecus: {
                            select: {
                                id: true,
                                hwid: true
                            }
                        }
                    }
                }
            }
        });

        auditEventEmitter.emit({
            actor_id: oryID,
            action: 'add_group_robot',
            team_id: teamID
        })

        const sanitisedGroupRobot: IGroupRobot = {
            robot_id: groupRobot.robot_id,
            created_at: groupRobot.created_at,
            ecus: groupRobot.robot.ecus.map(ecu => ({
                id: ecu.id,
                hwid: ecu.hwid
            }))
        };

        logger.info('A user has added a robot a group in one of their teams.');
        return new SuccessJsonResponse(res, sanitisedGroupRobot);


    } catch (error) {
        if (error.code === 'P2002') {
            logger.warn('a user is trying to add a robot to group that is already there');
            return new BadResponse(res, 'Cannot add robot to this group.');
        }
        next(error);
    }
}




/**
 * Remove robot from a group in requesters team.
 * 
 * The requester could potentially spoof the robotID or groupID, to try and act on a group
 * or robot in a team not belonging to them so we need to check there is a robot and group 
 * with the ids provided in their team
 */
export const removeRobotFromGroup = async (req: Request, res: Response, next: NextFunction) => {

    const oryID = req.oryIdentity!.traits.id;
    const teamID = req.headers['air-team-id']!;
    const groupID = req.params.group_id;

    const {
        robot_id
    } = req.body;

    try {

        const robot = await prisma.robot.findUnique({
            where: {
                team_id_id: {
                    id: robot_id,
                    team_id: teamID
                }
            }
        });

        const group = await prisma.group.findUnique({
            where: {
                id_team_id: {
                    id: groupID,
                    team_id: teamID
                }
            }
        });

        //The user could potentially spoof the robotID or groupID, so we need to check there is a robot and group with the ids provided in their team
        if (!robot || !group) {
            logger.error('A user tried to remove a robot from a group, that either doesnt exist or isnt in their team');
            return new BadResponse(res, 'Cannot delete the robot from this group.');
        }

        await prisma.robotGroup.delete({
            where: {
                team_id_robot_id_group_id: {
                    team_id: teamID,
                    robot_id: robot_id,
                    group_id: groupID
                }
            }
        });

        auditEventEmitter.emit({
            actor_id: oryID,
            action: 'remove_group_robot',
            team_id: teamID
        })

        return new NoContentResponse(res, 'The robot has been removed from the group');

    } catch (error) {
        next(error);
    }
}


import e, { Request, Response, NextFunction } from 'express';
import { BadResponse, SuccessJsonResponse, NoContentResponse } from '@airbotics-core/network/responses';
import { logger } from '@airbotics-core/logger';
import prisma from '@airbotics-core/drivers/postgres';
import { ICreateGroupBody, IGroup, IGroupRobot } from '@airbotics-types';
import { auditEvent } from '@airbotics-core/events';
import { EEventAction, EEventActorType, EEventResource } from '@airbotics-core/consts';



/**
 * Create new group in requesters team. 
 */
export const createGroup = async (req: Request, res: Response, next: NextFunction) => {

    const oryId = req.oryIdentity!.traits.id;
    const teamId = req.headers['air-team-id']!;

    const {
        name,
        description,
        robot_ids
    } = req.body as ICreateGroupBody;

    try {

        const group = await prisma.group.create({
            data: {
                name: name,
                description: description,
                team_id: teamId,
                robots: {
                    createMany: {
                        data: robot_ids.map(id => ({
                            robot_id: id,
                            team_id: teamId
                        }))
                    }
                }
            }
        });

        const sanitisedGroup: IGroup = {
            id: group.id,
            name: group.name,
            description: group.description,
            num_robots: robot_ids.length,
            created_at: group.created_at
        }

        auditEvent.emit({
            resource: EEventResource.Group,
            action: EEventAction.Created,
            actor_type: EEventActorType.User,
            actor_id: oryId,
            team_id: teamId,
            meta: {
                group_id: group.id,
                name,
            }
        });

        logger.info('A user has created a new group.');

        return new SuccessJsonResponse(res, sanitisedGroup);

    } catch (error) {
        // console.log(error);

        next(error);
    }
}



/**
 * Lists all groups in requesters team. 
 */
export const listGroups = async (req: Request, res: Response, next: NextFunction) => {

    const teamID = req.headers['air-team-id'];
    const { skip, take } = req.query;

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
            },
            skip: skip ? Number(skip) : undefined,
            take: take ? Number(take) : undefined
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

        auditEvent.emit({
            resource: EEventResource.Group,
            action: EEventAction.DetailsUpdated,
            actor_type: EEventActorType.User,
            actor_id: oryID,
            team_id: teamID,
            meta: {
                group_id: updatedGroup.id,
                name,
                description
            }
        });

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

        await prisma.group.delete({
            where: {
                id: groupID
            }
        });

        auditEvent.emit({
            resource: EEventResource.Group,
            action: EEventAction.Deleted,
            actor_type: EEventActorType.User,
            actor_id: oryID,
            team_id: teamID,
            meta: {
                group_id: group.id,
            }
        });

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
    const { skip, take } = req.query;

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
            name: groupRobot.robot.name,
            added_at: groupRobot.created_at,
            // ecus: groupRobot.robot.ecus.map(ecu => ({
            //     id: ecu.id,
            //     hwid: ecu.hwid,
            // }))
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

        auditEvent.emit({
            resource: EEventResource.Group,
            action: EEventAction.RobotAdded,
            actor_type: EEventActorType.User,
            actor_id: oryID,
            team_id: teamID,
            meta: {
                group_id: group.id,
                robot_id
            }
        });

        const sanitisedGroupRobot: IGroupRobot = {
            robot_id: groupRobot.robot_id,
            name: groupRobot.robot.name,
            added_at: groupRobot.created_at,
            // ecus: groupRobot.robot.ecus.map(ecu => ({
            //     id: ecu.id,
            //     hwid: ecu.hwid
            // }))
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

        auditEvent.emit({
            resource: EEventResource.Group,
            action: EEventAction.RobotRemoved,
            actor_type: EEventActorType.User,
            actor_id: oryID,
            team_id: teamID,
            meta: {
                group_id: group.id,
                robot_id
            }
        });

        return new NoContentResponse(res, 'The robot has been removed from the group');

    } catch (error) {
        next(error);
    }
}


import { Request, Response, NextFunction } from 'express';
import { BadResponse, SuccessJsonResponse } from '@airbotics-core/network/responses';
import { logger } from '@airbotics-core/logger';
import { Rollout, RolloutStatus } from '@prisma/client';
import { ICreateRolloutBody } from 'src/types';
import { RolloutTargetType } from '@airbotics-core/consts';
import { SuccessMessageResponse } from '../../../core/network/responses';
import { prisma } from '@airbotics-core/drivers';
import { generateStaticDelta } from '@airbotics-core/generate-static-delta';
import { airEvent } from '@airbotics-core/events';
import { EEventAction, EEventActorType, EEventResource } from '@airbotics-core/consts';


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
 * 
 * TODO: Generate deltas
 * 
 */
export const createRollout = async (req: Request, res: Response) => {

    const body: ICreateRolloutBody = req.body;

    const teamId = req.headers['air-team-id']!;
    const oryId = req.oryIdentity!.traits.id;


    const createdRollout: Rollout = await prisma.$transaction(async tx => {

        //Create the rollout
        const rollout = await tx.rollout.create({
            data: {
                team_id: teamId,
                name: body.name,
                description: body.description,
                status: RolloutStatus.preparing
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

        //determine which robots are affected by the rollout
        const robotIDs: string[] = [];
        const botTargetType = body.targeted_robots.type;

        if (botTargetType === RolloutTargetType.selected_bots) {
            robotIDs.push(...body.targeted_robots.selected_bot_ids!);
        }

        else if (botTargetType === RolloutTargetType.group) {

            const robotsInGroup = await tx.robotGroup.findMany({
                where: {
                    group_id: body.targeted_robots.group_id!
                },
                include: {
                    robot: { select: { id: true } }
                }
            });

            robotIDs.push(...robotsInGroup.map(botGrp => (botGrp.robot_id)));
        }

        else if (botTargetType === RolloutTargetType.hw_id_match) {

            const hwIds = body.hwid_img_map.map(elem => (elem.hw_id));

            const ecuRobots = await tx.ecu.findMany({
                where: {
                    hwid: { in: hwIds }
                },
                distinct: ['robot_id']
            });

            robotIDs.push(...ecuRobots.map(ecuBot => (ecuBot.robot_id)));
        }

        else {
            throw('Unknown robot target type for rollout');
        }

        await tx.rolloutRobot.createMany({
            data: robotIDs.map(id => ({
                rollout_id: rollout.id,
                robot_id: id
            }))
        });

        return rollout;

    });

    airEvent.emit({
        resource: EEventResource.Rollout,
        action: EEventAction.Created,
        actor_type: EEventActorType.User,
        actor_id: oryId,
        team_id: teamId,
        meta: null
    });


    logger.info('created rollout');

    return new SuccessJsonResponse(res, createdRollout);

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
    
    const rolloutId = req.params.rollout_id;
    const teamId = req.headers['air-team-id']!;

    try {
        await prisma.rollout.update({
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
    } 
    catch(e) {
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
    
    const rollouts = await prisma.rollout.findMany({
        where: {
            team_id: teamId
        },
        orderBy: {
            created_at: 'desc'
        }
    });

    logger.info('A user read a list of rollouts');
    
    return new SuccessJsonResponse(res, rollouts);
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
                select: { id: true, status: true }
            }
        }
    })

    if (!rollout) {
        logger.warn('could not get rollout details, either it does not exist or belongs to another team');
        return new BadResponse(res, 'Unable to get rollout details');
    }

    const rolloutSanitised = {
        id: rollout.id,
        created_at: rollout.created_at,
        updated_at: rollout.updated_at,
        robots: rollout.robots.map(bot => ({
            id: bot.id,
            status: bot.status
        }))
    }; 

    logger.info('A user read a rollout detail');
    return new SuccessJsonResponse(res, rolloutSanitised);
}

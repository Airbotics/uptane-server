import { Request, Response, NextFunction } from 'express';
import { BadResponse, SuccessJsonResponse } from '@airbotics-core/network/responses';
import { logger } from '@airbotics-core/logger';
import { RolloutStatus } from '@prisma/client';
import { ICreateRolloutBody } from 'src/types';
import { RolloutTargetType } from '@airbotics-core/consts';
import { prisma } from '../../../core/drivers/postgres';


/**
 * Create a rollout.
 * 
 * Creates an association betwen an ecu and image and triggers a delta generate
 */
export const createRollout = async (req: Request, res: Response) => {

    const {
        ecu_id,
        image_id
    } = req.body;

    const teamID = req.headers['air-team-id']!;

    // check ecu exists
    const ecu = await prisma.ecu.findUnique({
        where: {
            id: ecu_id
        }
    });

    if (!ecu) {
        logger.warn('could not create a rollout because ecu does not exist');
        return new BadResponse(res, 'could not create rollout');
    }

    // if this ecu has an image already then we'll create a delta between it and the image we want to go to
    if (ecu.image_id) {
        // TODO compute static delta
        // await generateStaticDelta(teamID, branch, from, to);
    }

    // check image exists
    const imageCount = await prisma.image.count({
        where: {
            id: image_id
        }
    });

    if (imageCount === 0) {
        logger.warn('could not create a rollout because image does not exist');
        return new BadResponse(res, 'could not create rollout');
    }

    const tmpRollout = await prisma.tmpEcuImages.create({
        data: {
            image_id,
            ecu_id
        }
    });

    const santistedRollout = {
        image_id: tmpRollout.image_id,
        ecu_id: tmpRollout.ecu_id,
        created_at: tmpRollout.created_at,
        updated_at: tmpRollout.updated_at
    };

    logger.info('created tmp rollout');
    return new SuccessJsonResponse(res, santistedRollout);

}

/**
 * List rollouts.
 * 
 * TODO
 * - implement
 */
export const listRollouts = async (req: Request, res: Response) => {
    logger.info('a user has gotten a list of rollout');
    return new SuccessJsonResponse(res, []);
}

/**
 * Get a rollout detail.
 * 
 * TODO
 * - implement
 */
export const getRollout = async (req: Request, res: Response) => {
    logger.info('a user has gotten details of a rollout');
    return new SuccessJsonResponse(res, {});
}


export const createRolloutReal = async (req: Request, res: Response) => {

    const {
        name,
        description, 
        hwid_img_map,
        targeted_devices
    }: ICreateRolloutBody = req.body;

    const teamID = req.headers['air-team-id']!;

    //Create the rollout
    const rollout = await prisma.rollout.create({
        data: {
            team_id: teamID,
            name: name,
            description: description,
            status: RolloutStatus.launched
        }
    });

    //Add the hw_id to image_id map for the rollout
    await prisma.rolloutTarget.createMany({
        data: hwid_img_map.map(elem => ({
            rollout_id: rollout.id,
            hw_id: elem.hw_id,
            image_id: elem.hw_id
            
        }))
    });

    //determin which robots are affected by the rollout
    const robotIDs: string[] = [];
    const targetsType = targeted_devices.type;

    if(targetsType === RolloutTargetType.selected_bots) {
        robotIDs.push(...targeted_devices.selected_bot_ids!);
    }

    else if (targetsType === RolloutTargetType.group) {

        const robotsInGroup = await prisma.robotGroup.findMany({
            where: {
                group_id: targeted_devices.group_id!
            },
            include: {
                robot: { select: { id: true } }
            }
        });

        robotIDs.push(...robotsInGroup.map(botGrp => (botGrp.robot_id)));
    }
    
    else if (targetsType === RolloutTargetType.hw_id_match) {
        
        const hwIds = hwid_img_map.map(elem => (elem.hw_id));

        const ecuRobots = await prisma.ecu.findMany({
            where: {
                hwid: { in: hwIds }
            },
            distinct: ['robot_id']
        });

        robotIDs.push(...ecuRobots.map(ecuBot => (ecuBot.robot_id)));
    }

    else {
        return new BadResponse(res, 'Robots to associated with this rollout were not provided');
    }

    await prisma.rolloutRobot.createMany({
        data: robotIDs.map(id => ({
            rollout_id: rollout.id,
            robot_id: id
        }))
    });

    logger.info('created rollout');
    return new SuccessJsonResponse(res, rollout);

}
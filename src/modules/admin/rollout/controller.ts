import { Request, Response, NextFunction } from 'express';
import { BadResponse, SuccessJsonResponse } from '@airbotics-core/network/responses';
import { logger } from '@airbotics-core/logger';
import prisma from '@airbotics-core/drivers/postgres';
import { generateStaticDelta } from '@airbotics-core/generate-static-delta';


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


export const createRolloutb = async (req: Request, res: Response) => {

    const {
        name,
        description, 
        hwid_img_map,
        targeted_devices
    } = req.body;

    const teamID = req.headers['air-team-id']!;

    const targetsType = targeted_devices.type;

    await prisma


}
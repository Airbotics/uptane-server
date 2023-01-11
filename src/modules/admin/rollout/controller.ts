
import { Request, Response, NextFunction } from 'express';
import {  BadResponse, SuccessJsonResponse } from '@airbotics-core/network/responses';
import { logger } from '@airbotics-core/logger';
import prisma from '@airbotics-core/drivers/postgres';



/**
 * Create a rollout.
 * 
 * Creates an association betwen an ecu and image.
 */
export const createRollout = async (req: Request, res: Response, next: NextFunction) => {

    const {
        ecu_id,
        image_id
    } = req.body;


    const teamID = req.headers['air-team-id'];

    // check robot exists
    const ecuCount = await prisma.ecu.count({
        where: {
            id: ecu_id
        }
    });

    if (ecuCount === 0) {
        logger.warn('could not create a rollout because ecu does not exist');
        return new BadResponse(res, 'could not create rollout');
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

import { Request, Response, NextFunction } from 'express';
import { BadResponse, SuccessJsonResponse } from '@airbotics-core/network/responses';
import { logger } from '@airbotics-core/logger';
import prisma from '@airbotics-core/drivers/postgres';


/**
 * List images in a team.
 */
export const listImages = async (req: Request, res: Response) => {

    const teamID = req.headers['air-team-id'];

    const images = await prisma.image.findMany({
        where: {
            team_id: teamID
        },
        orderBy: {
            created_at: 'desc'
        }
    });

    const imagesSanitised = images.map(image => ({
        id: image.id,
        size: image.size,
        sha256: image.sha256,
        hwids: image.hwids,
        status: image.status,
        format: image.format,
        created_at: image.created_at,
        updated_at: image.updated_at
    }));

    logger.info('A user read a list of images');
    return new SuccessJsonResponse(res, imagesSanitised);

}


/**
 * Get an image in a team.
 */
export const getImage = async (req: Request, res: Response) => {

    const teamID = req.headers['air-team-id']!;
    const imageID = req.params.image_id;

    const image = await prisma.image.findUnique({
        where: {
            team_id_id: {
                team_id: teamID,
                id: imageID
            }
        },
    });

    if (!image) {
        logger.warn('could not get info about image because it or the team does not exist');
        return new BadResponse(res, 'Unable to get image');
    }

    const imageSanitised = {
        id: image.id,
        size: image.size,
        sha256: image.sha256,
        hwids: image.hwids,
        status: image.status,
        format: image.format,
        created_at: image.created_at,
        updated_at: image.updated_at
    };

    logger.info('A user gotten an image detail');
    return new SuccessJsonResponse(res, imageSanitised);

}
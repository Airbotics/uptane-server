import { Request, Response, NextFunction } from 'express';
import { BadResponse, SuccessJsonResponse } from '@airbotics-core/network/responses';
import { logger } from '@airbotics-core/logger';
import { prisma } from '@airbotics-core/drivers';
import { IImageRobotRes } from '@airbotics-types';
import { airEvent } from '@airbotics-core/events';
import { EEventAction, EEventActorType, EEventResource } from '@airbotics-core/consts';


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
        name: image.name,
        size: image.size,
        sha256: image.sha256,
        hwids: image.hwids,
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
        name: image.name,
        description: image.description,
        size: image.size,
        sha256: image.sha256,
        hwids: image.hwids,
        format: image.format,
        created_at: image.created_at,
        updated_at: image.updated_at
    };

    logger.info('A user gotten an image detail');
    return new SuccessJsonResponse(res, imageSanitised);

}



/**
 * Update image detail.
 */
 export const updateImageDetails = async (req: Request, res: Response) => {

    const oryID = req.oryIdentity!.traits.id;
    const teamID = req.headers['air-team-id']!;
    const imageID = req.params.image_id;

    const {description} = req.body;

    const image = await prisma.image.findUnique({
        where: {
            team_id_id: {
                team_id: teamID,
                id: imageID
            }
        },
    });

    if (!image) {
        logger.warn('could not updateimage because it or the team does not exist');
        return new BadResponse(res, 'Unable to update image');
    }

    const newImage = await prisma.image.update({
        where: {
            team_id_id: {
                team_id: teamID,
                id: imageID
            }
        },
        data: {
            description
        }
    });

    airEvent.emit({
        resource: EEventResource.Image,
        action: EEventAction.DetailsUpdated,
        actor_type: EEventActorType.User,
        actor_id: oryID,
        team_id: teamID,
        meta: {
            id: newImage.id
        }
    });

    const imageSanitised = {
        id: newImage.id,
        name: newImage.name,
        description: newImage.description,
        size: newImage.size,
        sha256: newImage.sha256,
        hwids: newImage.hwids,
        format: newImage.format,
        created_at: newImage.created_at,
        updated_at: newImage.updated_at
    };

    logger.info('A user update an image detail');
    return new SuccessJsonResponse(res, imageSanitised);

}

/**
 * 
 */
export const listRobotsWithImage = async (req: Request, res: Response) => {

    const teamID = req.headers['air-team-id']!;
    const imageID = req.params.image_id;

    const ecus = await prisma.ecu.findMany({
        where: {
            image_id: imageID,
            team_id: teamID
        },
        include: {
            robot: true
        }
    })

    const ecusSanitised: IImageRobotRes[] = ecus.map(ecu => ({
        robot: {
            id: ecu.robot.id,
            name: ecu.robot.name
        },
        ecu: {
            id: ecu.id,
            hw_id: ecu.hwid,
            primary: ecu.primary,
            updated_at: ecu.updated_at
        }
    }))

    logger.info('A user read a list of robots that have an image installed');
    return new SuccessJsonResponse(res, ecusSanitised);

}


/**
 * Edgecase for deleting Image 
 * 
 * If the image is associated with a RolloutRobot that has a status of 'scheduled' or 'accepted',
 * a robot may be in the process of pulling the image and will need to be checked for.
 * 
 */
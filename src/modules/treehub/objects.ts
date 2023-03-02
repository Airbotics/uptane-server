import express, { Request, Response } from 'express';
import { UploadStatus } from '@prisma/client';
import { logger } from '@airbotics-core/logger';
import { prisma } from '@airbotics-core/drivers';
import { blobStorage } from '@airbotics-core/blob-storage';
import { mustBeRobot, updateRobotMeta } from '@airbotics-middlewares';
import { TREEHUB_BUCKET } from '@airbotics-core/consts';
import config from '@airbotics-config';
import { BadResponse, InternalServerErrorResponse, NotFoundResponse, SuccessEmptyResponse } from '@airbotics-core/network/responses';

const router = express.Router();



const downloadObject = async (req: Request, res: Response) => {

    const team_id = req.params.team_id || req.robotGatewayPayload!.team_id;

    const prefix = req.params.prefix;
    const suffix = req.params.suffix;
    const object_id = prefix + suffix;

    const object = await prisma.object.findUnique({
        where: {
            team_id_object_id: {
                team_id,
                object_id
            }
        }
    });

    if (!object) {
        logger.warn('could not get ostree object because it does not exist');
        return new NotFoundResponse(res);
    }

    try {
        const content = await blobStorage.getObject(TREEHUB_BUCKET, team_id, `objects/${prefix}/${suffix}`);

        res.set('content-type', 'application/octet-stream');
        return res.status(200).send(content);

    } catch (error) {
        // db and blob storage should be in sync
        // if an object exists in db but not blob storage something has gone wrong, bail on this request
        logger.error('ostree object in postgres and blob storage are out of sync');
        return new InternalServerErrorResponse(res);
    }


}



/**
 * Uploads an object to blob storage.
 * 
 * Will store in s3 or local filesystem depending on config.
 */
router.post('/:team_id/objects/:prefix/:suffix', express.raw({ type: '*/*', limit: config.MAX_TREEHUB_REQUEST_SIZE }), async (req: Request, res) => {

    // const teamID = req.robotGatewayPayload!.team_id;
    const teamID = req.params.team_id;
    const prefix = req.params.prefix;
    const suffix = req.params.suffix;
    const content = req.body;
    const object_id = prefix + suffix;

    const size = parseInt(req.get('content-length')!);

    // if content-length was not sent, or it is zero, or it is not a number return 400
    if (!size || size === 0 || isNaN(size)) {
        logger.warn('could not upload ostree object because content-length header was not sent');
        return new BadResponse(res, '');
    }

    const teamCount = await prisma.team.count({
        where: {
            id: teamID
        }
    });

    if (teamCount === 0) {
        logger.warn('could not upload ostree object because team does not exist');
        return new BadResponse(res, '');
    }


    await prisma.$transaction(async tx => {

        await tx.object.upsert({
            create: {
                team_id: teamID,
                object_id,
                size,
                status: UploadStatus.uploading
            },
            update: {
                size,
                status: UploadStatus.uploading
            },
            where: {
                team_id_object_id: {
                    team_id: teamID,
                    object_id
                }
            }
        });

        await blobStorage.putObject(TREEHUB_BUCKET, teamID, `objects/${prefix}/${suffix}`, content);

        await tx.object.update({
            where: {
                team_id_object_id: {
                    team_id: teamID,
                    object_id
                }
            },
            data: {
                status: UploadStatus.uploaded
            }
        });

    });

    logger.info('uploaded ostree object');

    return res.status(204).end();

});


/**
 * Checks for the existence of an object in blob storage.
 * 
 * Note: this does not directly interface with blob storage, instead it checks
 * the record of it in Postgres. This assumes they are in sync.
 */
router.head('/:team_id/objects/:prefix/:suffix', async (req: Request, res) => {

    // const teamID = req.robotGatewayPayload!.team_id;
    const teamID = req.params.team_id;
    const prefix = req.params.prefix;
    const suffix = req.params.suffix;
    const object_id = prefix + suffix;


    const object = await prisma.object.findUnique({
        where: {
            team_id_object_id: {
                team_id: teamID,
                object_id
            }
        }
    });

    if (!object) {
        return new NotFoundResponse(res);
    }

    return new SuccessEmptyResponse(res);

});


/**
 * Gets an object from blob storage.
 * 
 * Will fetch from s3 or local filesystem depending on config.
 */
router.get('/:team_id/objects/:prefix/:suffix', downloadObject);


/**
 * Gets an object from blob storage.
 * 
 * Will fetch from s3 or local filesystem depending on config.
 */
router.get('/objects/:prefix/:suffix', mustBeRobot, updateRobotMeta, downloadObject);


export default router;
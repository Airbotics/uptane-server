import express, { Request, Response } from 'express';
import { UploadStatus } from '@prisma/client';
import { logger } from '@airbotics-core/logger';
import { prisma } from '@airbotics-core/drivers';
import { blobStorage } from '@airbotics-core/blob-storage';
import { mustBeRobot, updateRobotMeta } from '@airbotics-middlewares';
import config from '@airbotics-config';
import { BadResponse, InternalServerErrorResponse, NotFoundResponse, SuccessEmptyResponse } from '@airbotics-core/network/responses';
import { binaryFromStream } from '@airbotics-core/utils';
import { Readable } from 'stream';
import { GetObjectCommand, GetObjectCommandOutput, S3Client } from '@aws-sdk/client-s3';
import { generateHash } from '@airbotics-core/crypto';
import { EHashDigest } from '@airbotics-core/consts';

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
        return res.status(404).end();
    }

    try {
        
        const content = await blobStorage.getObject(config.TREEHUB_BUCKET_NAME!, team_id, `objects/${prefix}/${suffix}`);
        const binaryStr: string = await binaryFromStream(content as Readable)

        res.writeHead(200, {
            'Accept-Ranges': 'bytes',
            'Content-Type': 'application/octet-stream',
        });
 
        res.end(binaryStr, 'binary')


    } catch (error) {
        // db and blob storage should be in sync
        // if an object exists in db but not blob storage something has gone wrong, bail on this request
        logger.error('ostree object in postgres and blob storage are out of sync');
        return res.status(500).end();
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
        return res.status(400).end();
    }

    const teamCount = await prisma.team.count({
        where: {
            id: teamID
        }
    });

    if (teamCount === 0) {
        logger.warn('could not upload ostree object because team does not exist');
        return res.status(400).end();
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

        await blobStorage.putObject(config.TREEHUB_BUCKET_NAME!, teamID, `objects/${prefix}/${suffix}`, content);

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
        return res.status(404).end();
    }

    return res.status(200).end();

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
import express, { Request, Response } from 'express';
import { UploadStatus } from '@prisma/client';
import { logger } from '@airbotics-core/logger';
import { prisma } from '@airbotics-core/postgres';
import { blobStorage } from '@airbotics-core/blob-storage';
import { mustBeRobot } from 'src/middlewares';

const router = express.Router();


/**
 * Upload summary
 */
router.put('/:team_id/summary', express.raw({ type: '*/*' }), async (req: Request, res: Response) => {

    const teamID = req.params.team_id;
    const objectID = 'summary';
    const bucketId = teamID + '/' + objectID;
    const content = req.body;

    const size = parseInt(req.get('content-length')!);

    // if content-length was not sent, or it is zero, or it is not a number return 400
    if (!size || size === 0 || isNaN(size)) {
        logger.warn('could not upload ostree summary because content-length header was not sent');
        return res.status(400).end();
    }

    const teamCount = await prisma.team.count({
        where: {
            id: teamID
        }
    });

    if (teamCount === 0) {
        logger.warn('could not upload ostree summary because team does not exist');
        return res.status(400).send('could not upload ostree summary');
    }

    await prisma.$transaction(async tx => {

        await tx.object.upsert({
            create: {
                team_id: teamID,
                object_id: objectID,
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
                    object_id: objectID
                }
            }
        });

        await blobStorage.putObject(teamID, 'treehub/summary', content);

        await tx.object.update({
            where: {
                team_id_object_id: {
                    team_id: teamID,
                    object_id: objectID
                }
            },
            data: {
                status: UploadStatus.uploaded
            }
        });

    });

    logger.info('uploaded ostree summary');
    return res.status(200).end();

});


/**
 * Download summary
 */
router.get('/summary', mustBeRobot, async (req: Request, res) => {

    const { team_id } = req.robotGatewayPayload!;

    const object_id = 'summary';

    const summary = await prisma.object.findUnique({
        where: {
            team_id_object_id: {
                team_id,
                object_id
            }
        }
    });

    if (!summary) {
        logger.warn('could not download ostree summary because it does not exist')
        return res.status(404).end();
    }

    try {
        const content = await blobStorage.getObject(team_id, 'treehub/summary');

        res.set('content-type', 'application/octet-stream');
        return res.status(200).send(content);

    } catch (error) {
        // db and blob storage should be in sync
        // if an object exists in db but not blob storage something has gone wrong, bail on this request
        return res.status(500).end();
    }

});


/**
 * Download summary
 */
router.get('/summary.sig', mustBeRobot, async (req: Request, res) => {

    const { team_id } = req.robotGatewayPayload!;

    const object_id = 'summary';

    const summary = await prisma.object.findUnique({
        where: {
            team_id_object_id: {
                team_id,
                object_id
            }
        }
    });

    if (!summary) {
        logger.warn('could not download ostree summary because it does not exist')
        return res.status(404).end();
    }

    try {
        const content = await blobStorage.getObject(team_id, 'treehub/summary');

        res.set('content-type', 'application/octet-stream');
        return res.status(200).send(content);

    } catch (error) {
        // db and blob storage should be in sync
        // if an object exists in db but not blob storage something has gone wrong, bail on this request
        return res.status(500).end();
    }

});


export default router;
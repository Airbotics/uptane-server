import express, { Request, Response } from 'express';
import { logger } from '@airbotics-core/logger';
import { prisma } from '@airbotics-core/drivers';
import { blobStorage } from '@airbotics-core/blob-storage';
import { mustBeRobot, updateRobotMeta } from '@airbotics-middlewares';
import config from '@airbotics-config';
import { BadResponse, NotFoundResponse, SuccessBinaryResponse, SuccessEmptyResponse } from '@airbotics-core/network/responses';
import { binaryFromStream } from '@airbotics-core/utils';
import { Readable } from 'stream';

const router = express.Router();


const downloadSummary = async (req: Request, res: Response) => {

    const team_id = req.params.team_id || req.robotGatewayPayload!.team_id;

    try {
        const content = await blobStorage.getObject(config.TREEHUB_BUCKET_NAME!, team_id, 'summary');
        const binaryStr = await binaryFromStream(content as Readable) 

        res.set('content-type', 'application/octet-stream');
        return new SuccessBinaryResponse(res, binaryStr);

    } catch (error) {
        return res.status(404).end();
    }

}


/**
 * Upload a summary.
 * 
 * TODO
 * - check size in header matches size of request body.
 * - restrict allowable mime-types
 */
router.put('/:team_id/summary', express.raw({ type: '*/*', limit: config.MAX_TREEHUB_REQUEST_SIZE }), async (req: Request, res: Response) => {

    const teamID = req.params.team_id;
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
        return res.status(400).end();
    }

    await blobStorage.putObject(config.TREEHUB_BUCKET_NAME!,  teamID, 'summary', content);

    logger.info('uploaded ostree summary');
    return res.status(200).end();

});

// download summary
router.get('/:team_id/summary', downloadSummary);

// download summary
router.get('/summary', mustBeRobot, updateRobotMeta, downloadSummary);


export default router;
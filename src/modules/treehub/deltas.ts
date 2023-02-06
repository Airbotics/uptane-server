import express, { Request } from 'express';
import { StaticDeltaStatus } from '@prisma/client';
import { prisma } from '@airbotics-core/drivers';
import { blobStorage } from '@airbotics-core/blob-storage'
import { logger } from '@airbotics-core/logger';
import { extractCommitsFromDelta } from '@airbotics-core/utils';
import { mustBeRobot, updateRobotMeta } from '@airbotics-middlewares';
import { TREEHUB_BUCKET } from '@airbotics-core/consts';


const router = express.Router();


/**
 * Gets a static delta from treehub.
 * 
 * Example request:
 * `/deltas/M2/_TV2F38wdBiLREy1xvUUcgSh81HRez7odWfAzjM_k-NdSxsgJmi+UxquZCbebOp1Qaswjy_Ft6jykJhdo251A/superblock`
 */
router.get('/deltas/:prefix/:suffix/:file', mustBeRobot, async (req: Request, res) => {

    const team_id = req.robotGatewayPayload!.team_id;
    const prefix = req.params.prefix;
    const suffix = req.params.suffix;
    const file = req.params.file;

    return res.status(404).end();

    /*
    const { from, to } = extractCommitsFromDelta(prefix, suffix);

    const delta = await prisma.staticDelta.findUnique({
        where: {
            team_id_from_to: {
                team_id,
                from,
                to
            }
        }
    });

    if (!delta) {
        logger.warn('trying to fetch a delta that does not exist');
        return res.status(404).end();
    }

    if (delta?.status !== StaticDeltaStatus.succeeded) {
        logger.warn('trying to fetch a delta that exists but has not been successfully generated');
        return res.status(404).end();
    }

    try {

        const content = await blobStorage.getObject(TREEHUB_BUCKET, team_id, `deltas/${prefix}/${suffix}/${file}`);

        res.set('content-type', 'application/octet-stream');
        return res.status(200).send(content);

    } catch (error) {
        // db and blob storage should be in sync
        // if an delta exists in db but not blob storage something has gone wrong, bail on this request
        logger.error('ostree delta in postgres and blob storage are out of sync');
        return res.status(500).end();
    }
    */

});


export default router;
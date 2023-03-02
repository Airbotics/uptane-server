import express, { Request, Response } from 'express';
import { prisma } from '@airbotics-core/drivers';
import { logger } from '@airbotics-core/logger';
import { OSTREE_CONFIG } from '@airbotics-core/consts';
import { mustBeRobot, updateRobotMeta } from '@airbotics-middlewares';
import { BadResponse, SuccessBinaryResponse } from '@airbotics-core/network/responses';

const router = express.Router();


const getConfig = async (req: Request, res: Response) => {

    const team_id = req.params.team_id || req.robotGatewayPayload!.team_id;

    const teamCount = await prisma.team.count({
        where: {
            id: team_id
        }
    });

    if (teamCount === 0) {
        logger.warn('could not get ostree config because team does not exist');
        return new BadResponse(res, '');
    }

    res.set('content-type', 'text/plain');
    return new SuccessBinaryResponse(res, OSTREE_CONFIG);
    
}


/**
 * Returns ostree config
 * 
 * - The config is hardcoded and simply returned in plaintext if the team exists.
 */
router.get('/config', mustBeRobot, updateRobotMeta, getConfig);

router.get('/:team_id/config', getConfig);


export default router;
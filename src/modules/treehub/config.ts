import express, { Request } from 'express';
import { prisma } from '@airbotics-core/postgres';
import { logger } from '@airbotics-core/logger';
import { OSTREE_CONFIG } from '@airbotics-core/consts';
import { mustBeRobot } from 'src/middlewares';

const router = express.Router();


/**
 * Returns ostree config
 * 
 * - The config is hardcoded and simply returned in plaintext if the team exists.
 */
router.get('/config', mustBeRobot, async (req: Request, res) => {

    const { team_id } = req.robotGatewayPayload!;

    const teamCount = await prisma.team.count({
        where: {
            id: team_id
        }
    });

    if (teamCount === 0) {
        logger.warn('could not get ostree config because team does not exist');
        return res.status(400).end();
    }

    res.set('content-type', 'text/plain');
    return res.status(200).send(OSTREE_CONFIG);
    
});


export default router;
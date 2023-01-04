import express, { Request } from 'express';
import { prisma } from '@airbotics-core/postgres';
import { logger } from '@airbotics-core/logger';
import { OSTREE_CONFIG } from '@airbotics-core/consts';
import { ensureRobotAndNamespace } from 'src/middlewares';

const router = express.Router();


/**
 * Returns ostree config
 * 
 * - The config is hardcoded and simply returned in plaintext if the namespace exists.
 */
router.get('/config', ensureRobotAndNamespace, async (req: Request, res) => {

    const { namespace_id } = req.robotGatewayPayload!;

    const namespaceCount = await prisma.namespace.count({
        where: {
            id: namespace_id
        }
    });

    if (namespaceCount === 0) {
        logger.warn('could not get ostree config because namespace does not exist');
        return res.status(400).end();
    }

    res.set('content-type', 'text/plain');
    return res.status(200).send(OSTREE_CONFIG);
    
});


export default router;
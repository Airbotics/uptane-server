import express from 'express';
import { prisma } from '../../core/postgres';
import { logger } from '../../core/logger';
import { OSTREE_CONFIG } from '../../core/consts';

const router = express.Router();


/**
 * Gets ostree config.
 * 
 * - The config is hardcoded and simply returned in plaintext if the namespace exists.
 */
router.get('/:namespace/config', async (req, res) => {

    const namespace_id = req.params.namespace;

    const namespaceCount = await prisma.namespace.count({
        where: {
            id: namespace_id
        }
    });

    if (namespaceCount === 0) {
        logger.warn('could not get ostree config because namespace does not exist');
        return res.status(400).send('could not get ostree config');
    }

    res.set('content-type', 'text/plain');
    return res.status(200).send(OSTREE_CONFIG);
});


export default router;
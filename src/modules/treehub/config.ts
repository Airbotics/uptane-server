import express from 'express';
import { OSTREE_CONFIG } from '../../core/consts';

const router = express.Router();


/**
 * Gets ostree config.
 */
router.get('/:repo_id/config', (req, res) => {
    res.set('content-type', 'text/plain');
    return res.status(200).send(OSTREE_CONFIG);
});


export default router;
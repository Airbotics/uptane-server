import express from 'express';
import { blobStorage } from '../../core/blob-storage';

const router = express.Router();


/**
 * Upload summary.
 */
router.put('/:repo_id/summary', express.raw({ type: '*/*' }), async (req, res) => {

    const repo_id = req.params.repo_id;
    const content = req.body;

    const bucketId = repo_id + '/summary';

    await blobStorage.putObject(bucketId, content);

    return res.status(200).end();
});


/**
 * Download summary.
 */
router.get('/:repo_id/summary', async (req, res) => {

    const repo_id = req.params.repo_id;

    const bucketId = repo_id + '/summary';

    const content = await blobStorage.getObject(bucketId);

    res.set('content-type', 'application/text-plain');
    return res.status(200).send(content);

});


export default router;
import express from 'express';
import { blobStorage } from '../../core/blob-storage';

const router = express.Router();


/**
 * Upload summary.
 */
router.put('/:namespace/summary', express.raw({ type: '*/*' }), async (req, res) => {

    const namespace = req.params.namespace;
    const content = req.body;

    const bucketId = namespace + '/summary';

    await blobStorage.putObject(bucketId, content);

    return res.status(200).end();
});


/**
 * Download summary.
 */
router.get('/:namespace/summary', async (req, res) => {

    const namespace = req.params.namespace;

    const bucketId = namespace + '/summary';

    const content = await blobStorage.getObject(bucketId);

    res.set('content-type', 'application/text-plain');
    return res.status(200).send(content);

});


export default router;
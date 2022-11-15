import express from 'express';
import { ObjectStatus } from '@prisma/client';
import { prisma } from '../../core/postgres';
import { blobStorage } from '../../core/blob-storage';

const router = express.Router();


/**
 * Upload summary.
 */
router.put('/:namespace/summary', express.raw({ type: '*/*' }), async (req, res) => {

    const namespace_id = req.params.namespace;
    const object_id = 'summary';
    const bucketId = namespace_id + '/' + object_id;
    const content = req.body;

    const size = parseInt(req.get('content-length')!);

    // if content-length was not sent, or it is zero, or it is not a number return 400
    if (!size || size === 0 || isNaN(size)) {
        return res.status(400).end();
    }

    const namespaceCount = await prisma.namespace.count({
        where: {
            id: namespace_id
        }
    });

    if (namespaceCount === 0) {
        return res.status(400).send('could not upload ostree summary');
    }

    await prisma.$transaction(async tx => {

        await tx.object.upsert({
            create: {
                namespace_id,
                object_id,
                size,
                status: ObjectStatus.uploading
            },
            update: {
                size,
                status: ObjectStatus.uploading
            },
            where: {
                namespace_id_object_id: {
                    namespace_id,
                    object_id
                }
            }
        });

        await blobStorage.putObject(bucketId, content);

        await tx.object.update({
            where: {
                namespace_id_object_id: {
                    namespace_id,
                    object_id
                }
            },
            data: {
                status: ObjectStatus.uploaded
            }
        });
    });

    return res.status(200).end();

});


/**
 * Download summary.
 */
router.get('/:namespace/summary', async (req, res) => {

    const namespace_id = req.params.namespace;
    const object_id = 'summary';
    const bucketId = namespace_id + '/' + object_id;

    const object = await prisma.object.findUnique({
        where: {
            namespace_id_object_id: {
                namespace_id,
                object_id
            }
        }
    });

    if (!object) {
        return res.status(400).send('could not download ostree summary');
    }

    try {
        const content = await blobStorage.getObject(bucketId);

        res.set('content-type', 'application/octet-stream');
        return res.status(200).send(content);

    } catch (error) {
        // db and blob storage should be in sync
        // if an object exists in db but not blob storage something has gone wrong, bail on this request
        return res.status(500).end();
    }

});


export default router;
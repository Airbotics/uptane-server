import express from 'express';
import { UploadStatus } from '@prisma/client';
import { logger } from '@airbotics-core/logger';
import { prisma } from '@airbotics-core/postgres';
import { blobStorage } from '@airbotics-core/blob-storage';

const router = express.Router();

/**
 * Uploads an object to blob storage.
 * 
 * Will store in s3 or local filesystem depending on config.
 */
router.post('/:namespace/objects/:prefix/:suffix', express.raw({ type: '*/*', limit: '512mb' }), async (req, res) => {

    const namespace_id = req.params.namespace;
    const prefix = req.params.prefix;
    const suffix = req.params.suffix;
    const content = req.body;
    const object_id = prefix + suffix;

    const size = parseInt(req.get('content-length')!);

    // if content-length was not sent, or it is zero, or it is not a number return 400
    if (!size || size === 0 || isNaN(size)) {
        logger.warn('could not upload ostree object because content-length header was not sent');
        return res.status(400).end();
    }

    const namespaceCount = await prisma.namespace.count({
        where: {
            id: namespace_id
        }
    });

    if (namespaceCount === 0) {
        logger.warn('could not upload ostree object because namespace does not exist');
        return res.status(400).send('could not upload ostree object');
    }


    await prisma.$transaction(async tx => {

        await tx.object.upsert({
            create: {
                namespace_id,
                object_id,
                size,
                status: UploadStatus.uploading
            },
            update: {
                size,
                status: UploadStatus.uploading
            },
            where: {
                namespace_id_object_id: {
                    namespace_id,
                    object_id
                }
            }
        });

        await blobStorage.putObject(namespace_id, `treehub/${prefix}/${suffix}`, content);

        await tx.object.update({
            where: {
                namespace_id_object_id: {
                    namespace_id,
                    object_id
                }
            },
            data: {
                status: UploadStatus.uploaded
            }
        });

    });
    
    logger.info('uploaded ostree object');
    
    return res.status(204).end();

});


/**
 * Checks for the existence of an object in blob storage.
 * 
 * Note: this does not directly interface with blob storage, instead it checks
 * the record of it in Postgres. This assumes they are in sync.
 */
router.head('/:namespace/objects/:prefix/:suffix', async (req, res) => {

    const namespace_id = req.params.namespace;
    const prefix = req.params.prefix;
    const suffix = req.params.suffix;
    const object_id = prefix + suffix;

    
    const object = await prisma.object.findUnique({
        where: {
            namespace_id_object_id: {
                namespace_id,
                object_id
            }
        }
    });

    if (!object) {
        return res.status(404).end();
    }

    return res.status(200).end();

});


/**
 * Gets an object from blob storage.
 * 
 * Will fetch from s3 or local filesystem depending on config.
 */
router.get('/:namespace/objects/:prefix/:suffix', async (req, res) => {

    const namespace_id = req.params.namespace;
    const prefix = req.params.prefix;
    const suffix = req.params.suffix;
    const object_id = prefix + suffix;

    const object = await prisma.object.findUnique({
        where: {
            namespace_id_object_id: {
                namespace_id,
                object_id
            }
        }
    });

    if (!object) {
        logger.warn('could not get ostree object because it does not exist');
        return res.status(400).send('could not download ostree object');
    }

    try {
        const content = await blobStorage.getObject(namespace_id, `treehub/${prefix}/${suffix}`);

        res.set('content-type', 'application/octet-stream');
        return res.status(200).send(content);

    } catch (error) {
        // db and blob storage should be in sync
        // if an object exists in db but not blob storage something has gone wrong, bail on this request
        logger.error('ostree object in postgres and blob storage are out of sync');
        return res.status(500).end();
    }


});


export default router;
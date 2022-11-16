import express from 'express';
import { ObjectStatus } from '@prisma/client';
import { blobStorage } from '../../core/blob-storage';
import { prisma } from '../../core/postgres';


const router = express.Router();

/**
 * Upload an image in a namespace
 * 
 * For now this adds the image to blob storage but will later upload to treehub, 
 * it then signs the appropiate TUF metadata, then updates the inventory db.
 */
router.put('/:namespace/images', express.raw({ type: '*/*' }), async (req, res) => {

    const namespace = req.params.namespace;
    const content = req.body;

    const size = parseInt(req.get('content-length')!);

    // if content-length was not sent, or it is zero, or it is not a number return 400
    if (!size || size === 0 || isNaN(size)) {
        return res.status(400).end();
    }

    // check namespace exists
    const namespaceCount = await prisma.namespace.count({
        where: {
            id: namespace
        }
    });

    if (namespaceCount === 0) {
        return res.status(400).send('could not upload image');
    }

    // create image in db and upload to blob storage
    await prisma.$transaction(async tx => {

        const image = await tx.image.create({
            data: {
                namespace_id: namespace,
                size,
                status: ObjectStatus.uploading
            }
        });

        await blobStorage.putObject(image.id, content);

        await tx.image.update({
            where: {
                id: image.id
            },
            data: {
                status: ObjectStatus.uploaded
            }
        });
    });

    return res.status(200).end();

});


/**
 * List images in a namespace
 */
router.get('/:namespace/images', async (req, res) => {

    const namespace = req.params.namespace;

    // check namespace exists
    const namespaceCount = await prisma.namespace.count({
        where: {
            id: namespace
        }
    });

    if (namespaceCount === 0) {
        return res.status(400).send('could not list images');
    }

    // get images
    const images = await prisma.image.findMany({
        where: {
            namespace_id: namespace
        },
        orderBy: {
            created_at: 'desc'
        }
    });

    const response = images.map(image => ({
        id: image.id,
        size: image.size,
        status: image.status,
        created_at: image.created_at,
        updated_at: image.updated_at
    }));

    return res.status(200).json(response);

});



export default router;
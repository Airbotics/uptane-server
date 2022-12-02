import express, { Request } from 'express';
import { TUFRepo, TUFRole, Prisma } from '@prisma/client';
import { blobStorage } from '../../core/blob-storage';
import { prisma } from '../../core/postgres';
import { logger } from '../../core/logger';
import { ensureRobotAndNamespace } from '../../middlewares';


const router = express.Router();


/**
 * Download image using hash and image id.
 * 
 * NOTE:
 * - this must be defined before the controller for downloading an image using
 * the image id only. Otherwise express will not match the url pattern.
 */
router.get('/images/:hash.:id', ensureRobotAndNamespace, async (req: Request, res) => {

    const hash = req.params.hash;
    const id = req.params.id;
    const {
        namespace_id
    } = req.robotGatewayPayload!;

    // FIND image WHERE namespace = namespace AND image_id = image_id AND (sha256 = hash OR sha512 = hash)
    const image = await prisma.image.findFirst({
        where: {
            AND: [
                { namespace_id },
                { id },
                {
                    OR: [
                        { sha256: hash },
                        { sha512: hash }
                    ]
                }
            ]
        }
    });

    if (!image) {
        logger.warn('could not download image because it does not exist');
        return res.status(400).send('could not download image');
    }

    try {
        // const content = await blobStorage.getObject(bucketId);
        const content = await blobStorage.getObject(namespace_id, `images/${image.id}`);

        res.set('content-type', 'application/octet-stream');
        return res.status(200).send(content);

    } catch (error) {
        // db and blob storage should be in sync
        // if an image exists in db but not blob storage something has gone wrong, bail on this request
        logger.error('images in postgres and blob storage are out of sync');
        return res.status(500).end();
    }

});


/**
 * Download image using image id only.
 */
router.get('/images/:id', ensureRobotAndNamespace, async (req: Request, res) => {

    const id = req.params.id;
    const {
        namespace_id
    } = req.robotGatewayPayload!;

    const image = await prisma.image.findUnique({
        where: {
            namespace_id_id: {
                namespace_id,
                id
            }
        }
    });

    if (!image) {
        logger.warn('could not download image because it does not exist');
        return res.status(400).send('could not download image');
    }

    try {
        const content = await blobStorage.getObject(namespace_id, `images/${image.id}`);

        res.set('content-type', 'application/octet-stream');
        return res.status(200).send(content);

    } catch (error) {
        // db and blob storage should be in sync
        // if an image exists in db but not blob storage something has gone wrong, bail on this request
        logger.error('images in postgres and blob storage are out of sync');
        return res.status(500).end();
    }

});


/**
 * Fetch versioned role metadata in a namespace.
 */
router.get('/:version.:role.json', ensureRobotAndNamespace, async (req: Request, res) => {

    const version = Number(req.params.version);
    const role = req.params.role;
    const {
        namespace_id
    } = req.robotGatewayPayload!;

    const metadata = await prisma.metadata.findFirst({
        where: {
            namespace_id,
            repo: TUFRepo.image,
            role: role as TUFRole,
            version
        }
    });

    if (!metadata) {
        logger.warn(`could not download ${role} metadata because it does not exist`);
        return res.status(404).end();
    }

    // check it hasnt expired
    // TODO

    return res.status(200).send(metadata.value);

});


/**
 * Fetch latest metadata in a namespace.
 */
router.get('/:role.json', ensureRobotAndNamespace, async (req: Request, res) => {

    const role = req.params.role;
    const {
        namespace_id
    } = req.robotGatewayPayload!;

    const metadata = await prisma.metadata.findMany({
        where: {
            namespace_id,
            repo: TUFRepo.image,
            role: req.params.role as TUFRole
        },
        orderBy: {
            created_at: 'desc'
        }
    });

    if (metadata.length === 0) {
        logger.warn(`could not download ${role} metadata because it does not exist`);
        return res.status(404).end();
    }

    const mostRecentMetadata = metadata[0].value as Prisma.JsonObject;

    // check it hasnt expired
    // TODO

    return res.status(200).send(mostRecentMetadata);

});


export default router;
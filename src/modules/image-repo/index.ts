import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { UploadStatus, TUFRepo, TUFRole } from '@prisma/client';
import { blobStorage } from '../../core/blob-storage';
import config from '../../config';
import { prisma } from '../../core/postgres';
import { logger } from '../../core/logger';
import { generateHash } from '../../core/crypto';
import { generateSnapshot, generateTargets, generateTimestamp } from '../../core/tuf';
import { keyStorage } from '../../core/key-storage';
import { IKeyPair, ITargetsImages } from '../../types';


const router = express.Router();


/**
 * Upload an image in a namespace.
 * 
 * This is not an upsert operation, you cannot overwrite an image once it has been uploaded.
 * You can only upload one image/target at a time.
 * 
 * For now this adds the image to blob storage but will later upload to treehub, it also signs 
 * the appropiate TUF metadata, and updates the inventory db (i.e. postgres)
 * 
 * OPERATIONS:
 * - Checks namespace exists.
 * - Creates a reference to the image in postgres.
 * - Uploads image to blob storage.
 * - Updates the uploadstatus of image in postgres to uploaded.
 * - Creates a new set of metadata:
 *      - Gets hashes of image.
 *      - Determines the version the new targets.json should have.
 *      - Reads keys.
 *      - Assembles new signed targets.json.
 *      - Assembles new signed snapshot.json.
 *      - Assembles new signed timestamp.json.
 * - Commits everything to db.
 * 
 * TODO:
 * - valide the size/length reported by content-length header matches the length we actually receive
 * - include length and hash in snapshot and timestamp meta
 */
router.post('/:namespace/images', express.raw({ type: '*/*' }), async (req, res) => {

    const namespace_id = req.params.namespace;
    const imageContent = req.body;

    const size = parseInt(req.get('content-length')!);

    // if content-length was not sent, or it is zero, or it is not a number return 400
    if (!size || size === 0 || isNaN(size)) {
        logger.warn('could not create an image because content-length header was not sent');
        return res.status(400).end();
    }

    // check namespace exists
    const namespaceCount = await prisma.namespace.count({
        where: {
            id: namespace_id
        }
    });

    if (namespaceCount === 0) {
        logger.warn('could not create an image because namespace does not exist');
        return res.status(400).send('could not upload image');
    }

    // get hashes of image
    const sha256 = generateHash(imageContent, { algorithm: 'SHA256' });
    const sha512 = generateHash(imageContent, { algorithm: 'SHA512' });

    // count the number of previous targets, snapshot and timestamp
    // this gets the most recently created metadata and grabs its version
    // NOTE: this assumes the version column in the table is always in sync with what
    // is stored in the metadata json field
    const latestTargets = await prisma.metadata.findFirst({
        where: {
            namespace_id,
            repo: TUFRepo.image,
            role: TUFRole.targets
        },
        orderBy: {
            version: 'desc'
        }
    });

    const latestSnapshot = await prisma.metadata.findFirst({
        where: {
            namespace_id,
            repo: TUFRepo.image,
            role: TUFRole.snapshot
        },
        orderBy: {
            version: 'desc'
        }
    });

    const latestTimestamp = await prisma.metadata.findFirst({
        where: {
            namespace_id,
            repo: TUFRepo.image,
            role: TUFRole.timestamp
        },
        orderBy: {
            version: 'desc'
        }
    });

    // add one to get the new version as TUF uses 1-based indexing for metadata files
    const newTargetsVersion = latestTargets ? latestTargets.version + 1 : 1;
    const newSnapshotVersion = latestSnapshot ? latestSnapshot.version + 1 : 1;
    const newTimeStampVersion = latestTimestamp ? latestTimestamp.version + 1 : 1;


    // read in keys from key storage
    const targetsKeyPair: IKeyPair = {
        privateKey: await keyStorage.getKey(`${namespace_id}-image-targets-private`),
        publicKey: await keyStorage.getKey(`${namespace_id}-image-targets-public`)
    }

    const snapshotKeyPair: IKeyPair = {
        privateKey: await keyStorage.getKey(`${namespace_id}-image-snapshot-private`),
        publicKey: await keyStorage.getKey(`${namespace_id}-image-snapshot-public`)
    }

    const timestampKeyPair: IKeyPair = {
        privateKey: await keyStorage.getKey(`${namespace_id}-image-timestamp-private`),
        publicKey: await keyStorage.getKey(`${namespace_id}-image-timestamp-public`)
    }

    // assemble information about this image to be put in the targets.json metadata
    // we need to know what the image id is at this point so we create a uuid in js, this will
    // be used in the inventory db, tuf metadata and blob storage. there is a very small chance of a uuid collision here
    const imageId = uuidv4();

    const targetsImages: ITargetsImages = {
        [imageId]: {
            custom: {},
            length: size,
            hashes: {
                sha256,
                sha512
            }
        }
    };


    // generate new set of tuf metadata (apart from root)
    const targetsMetadata = generateTargets(config.TUF_TTL.IMAGE.TARGETS, newTargetsVersion, targetsKeyPair, targetsImages);
    const snapshotMetadata = generateSnapshot(config.TUF_TTL.IMAGE.SNAPSHOT, newSnapshotVersion, snapshotKeyPair, targetsMetadata);
    const timestampMetadata = generateTimestamp(config.TUF_TTL.IMAGE.TIMESTAMP, newTimeStampVersion, timestampKeyPair, snapshotMetadata);


    // perform db writes in transaction
    await prisma.$transaction(async tx => {

        // create tuf metadata
        // prisma wants to be passed an `object` instead of our custom interface so we cast it
        await tx.metadata.create({
            data: {
                namespace_id,
                repo: TUFRepo.image,
                role: TUFRole.targets,
                version: newTargetsVersion,
                value: targetsMetadata as object,
                expires_at: targetsMetadata.signed.expires
            }
        });

        await tx.metadata.create({
            data: {
                namespace_id,
                repo: TUFRepo.image,
                role: TUFRole.snapshot,
                version: newSnapshotVersion,
                value: snapshotMetadata as object,
                expires_at: targetsMetadata.signed.expires
            }
        });

        await tx.metadata.create({
            data: {
                namespace_id,
                repo: TUFRepo.image,
                role: TUFRole.timestamp,
                version: newTimeStampVersion,
                value: timestampMetadata as object,
                expires_at: targetsMetadata.signed.expires
            }
        });


        // create reference to image in db
        await tx.image.create({
            data: {
                id: imageId,
                namespace_id,
                size,
                sha256,
                sha512,
                status: UploadStatus.uploading
            }
        });

        // upload image to blob storage
        await blobStorage.putObject(namespace_id, `images/${imageId}`, imageContent);

        // update reference to image in db saying that it has completed uploading
        await tx.image.update({
            where: {
                namespace_id_id: {
                    namespace_id,
                    id: imageId
                }
            },
            data: {
                status: UploadStatus.uploaded
            }
        });

    });

    logger.info('created an image');
    return res.status(200).end();

});


/**
 * List images in a namespace.
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
        logger.warn('could not list images because namespace does not exist');
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
        sha256: image.sha256,
        sha512: image.sha512,
        status: image.status,
        created_at: image.created_at,
        updated_at: image.updated_at
    }));

    return res.status(200).json(response);

});


/**
 * Download image using hash and image id.
 * 
 * NOTE:
 * - this must be defined before the controller for downloading an image using
 * the image id only. Otherwise express will not match the url pattern.
 */
router.get('/:namespace/images/:hash.:id', async (req, res) => {

    const namespace_id = req.params.namespace;
    const hash = req.params.hash;
    const id = req.params.id;

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
router.get('/:namespace/images/:id', async (req, res) => {

    const namespace_id = req.params.namespace;
    const id = req.params.id;

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
 * Fetch role metadata (apart from timestamp) in a namespace
 * 
 * Timestamp is not handled with this route because it isn't prepended
 * with a dot, i.e. `/timestamp.json` instead not `/1.timestamp.json`
 */
router.get('/:namespace/:version.:role.json', async (req, res) => {

    const namespace_id = req.params.namespace;
    const version = Number(req.params.version);
    const role = req.params.role;

    const metadata = await prisma.metadata.findUnique({
        where: {
            namespace_id_repo_role_version: {
                namespace_id,
                repo: TUFRepo.image,
                role: role as TUFRole,
                version
            }
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
 * Fetch timestamp metadata in a namespace
 */
router.get('/:namespace/timestamp.json', async (req, res) => {

    const namespace_id = req.params.namespace;

    // get the most recent timestamp
    const timestamps = await prisma.metadata.findMany({
        where: {
            namespace_id,
            repo: TUFRepo.image,
            role: TUFRole.timestamp
        },
        orderBy: {
            created_at: 'desc'
        }
    });

    if (timestamps.length === 0) {
        logger.warn('could not download timestamp metadata because it does not exist');
        return res.status(404).end();
    }

    const mostRecentTimestamp = timestamps[0];

    // check it hasnt expired
    // TODO    

    return res.status(200).send(mostRecentTimestamp.value);

});


export default router;
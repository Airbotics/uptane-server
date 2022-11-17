import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { UploadStatus, TUFRepo, TUFRole } from '@prisma/client';
import { blobStorage } from '../../core/blob-storage';
import config from '../../config';
import { prisma } from '../../core/postgres';
import { generateHash } from '../../core/crypto';
import { toCanonical } from '../../core/utils';
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
 */
router.put('/:namespace/images', express.raw({ type: '*/*' }), async (req, res) => {

    const namespace_id = req.params.namespace;
    const content = req.body;

    const size = parseInt(req.get('content-length')!);

    // if content-length was not sent, or it is zero, or it is not a number return 400
    if (!size || size === 0 || isNaN(size)) {
        return res.status(400).end();
    }

    // check namespace exists
    const namespaceCount = await prisma.namespace.count({
        where: {
            id: namespace_id
        }
    });

    if (namespaceCount === 0) {
        return res.status(400).send('could not upload image');
    }

    // get hashes of image
    const sha256 = generateHash(content, { algorithm: 'SHA256' });
    const sha512 = generateHash(content, { algorithm: 'SHA512' });

    // count up the number of previous targets
    const existingTargetsCount = await prisma.metadata.count({
        where: {
            namespace_id,
            repo: TUFRepo.image,
            role: TUFRole.targets
        }
    });

    // add one to get the new version as TUF uses 1-based indexing for metadata files
    const version = existingTargetsCount + 1;


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
    // but first we need to know what the image id is at this point so we create a uuid in js which will
    // be used in the inventory db and blob storage. there is a very small chance of a uuid collision here
    const imageId = uuidv4();

    const targetsImages: ITargetsImages = {
        imageId: {
            custom: {},
            length: size,
            hashes: {
                sha256,
                sha512
            }
        }
    };


    // generate new set of tuf metadata (apart from root)
    const targetsMetadata = generateTargets(config.TUF_TTL.IMAGE.TARGETS, version, targetsKeyPair, targetsImages) as object;

    const snapshotMetadata = generateSnapshot(config.TUF_TTL.IMAGE.SNAPSHOT, version, snapshotKeyPair) as object;

    const timestampMetadata = generateTimestamp(config.TUF_TTL.IMAGE.TIMESTAMP, version, timestampKeyPair) as object;


    // perform db writes in transaction
    await prisma.$transaction(async tx => {

        // create tuf metadata
        await tx.metadata.create({
            data: {
                namespace_id,
                repo: TUFRepo.image,
                role: TUFRole.targets,
                version,
                value: targetsMetadata
            }
        });

        await tx.metadata.create({
            data: {
                namespace_id,
                repo: TUFRepo.image,
                role: TUFRole.snapshot,
                version,
                value: snapshotMetadata
            }
        });

        await tx.metadata.create({
            data: {
                namespace_id,
                repo: TUFRepo.image,
                role: TUFRole.timestamp,
                version,
                value: timestampMetadata
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
        await blobStorage.putObject(imageId, content);

        // update reference to image saying that it has completed uploading
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
    const bucketId = id;

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
        return res.status(400).send('could not download image');
    }

    try {
        const content = await blobStorage.getObject(bucketId);

        res.set('content-type', 'application/octet-stream');
        return res.status(200).send(content);

    } catch (error) {
        // db and blob storage should be in sync
        // if an image exists in db but not blob storage something has gone wrong, bail on this request
        return res.status(500).end();
    }

});


/**
 * Download image using image id only.
 */
router.get('/:namespace/images/:id', async (req, res) => {

    const namespace_id = req.params.namespace;
    const id = req.params.id;
    const bucketId = id;


    const image = await prisma.image.findUnique({
        where: {
            namespace_id_id: {
                namespace_id,
                id
            }
        }
    });

    if (!image) {
        return res.status(400).send('could not download image');
    }

    try {
        const content = await blobStorage.getObject(bucketId);

        res.set('content-type', 'application/octet-stream');
        return res.status(200).send(content);

    } catch (error) {
        // db and blob storage should be in sync
        // if an image exists in db but not blob storage something has gone wrong, bail on this request
        return res.status(500).end();
    }

});


/**
 * Fetch role metadata (apart from timestamp) in a namespace
 * 
 * Timestamp is not handled with this route because it isn't prepended
 * with a dot, i.e. ``/timestamp.json`` instead not ``/1.timestamp.json``
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
        return res.status(400).send('cannot get metadata');
    }

    // check it hasnt expired
    // TODO    

    // canonicalise it and return it
    const canonicalisedMetadata = toCanonical(metadata.value as object);

    return res.status(200).send(canonicalisedMetadata);

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
        return res.status(400).send('cannot get metadata');
    }

    const mostRecentTimestamp = timestamps[0];

    // check it hasnt expired
    // TODO    

    // canonicalise it and return it
    const canonicalisedMetadata = toCanonical(mostRecentTimestamp.value as object);

    return res.status(200).send(canonicalisedMetadata);

});


export default router;
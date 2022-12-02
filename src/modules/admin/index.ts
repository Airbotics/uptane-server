import express from 'express';
import { UploadStatus, TUFRepo, TUFRole } from '@prisma/client';
import archiver from 'archiver';
import forge from 'node-forge';
import { v4 as uuidv4 } from 'uuid';
import { loadKeyPair } from '../../core/key-storage';
import { ETargetFormat } from '../../core/consts';
import { generateHash } from '../../core/crypto';
import {
    generateSnapshot,
    generateTargets,
    generateTimestamp,
    getLatestMetadata,
    getLatestMetadataVersion
} from '../../core/tuf';
import { ITargetsImages } from '../../types';
import config from '../../config';
import { prisma } from '../../core/postgres';
import { generateCertificate, generateKeyPair } from '../../core/crypto';
import { keyStorage } from '../../core/key-storage';
import { blobStorage } from '../../core/blob-storage';
import { generateRoot } from '../../core/tuf';
import { logger } from '../../core/logger';
import {
    RootCABucket,
    RootCACertObjId,
    RootCAPrivateKeyId,
    RootCAPublicKeyId
} from '../../core/consts';

const router = express.Router();


/**
 * Initialises a namespace
 * 
 * - Creates namespace in db.
 * - Creats bucket in blob storage to hold its blobs.
 * - Generates online TUF keys.
 * - Creates initial image and director root.json metadata files and saves them to the db.
 */
router.post('/namespaces', async (req, res) => {

    // generate 8 TUF key pairs, 4 top-level metadata keys for 2 repos
    const imageRootKey = generateKeyPair(config.KEY_TYPE);
    const imageTargetsKey = generateKeyPair(config.KEY_TYPE);
    const imageSnapshotKey = generateKeyPair(config.KEY_TYPE);
    const imageTimestampKey = generateKeyPair(config.KEY_TYPE);

    const directorRootKey = generateKeyPair(config.KEY_TYPE);
    const directorTargetsKey = generateKeyPair(config.KEY_TYPE);
    const directorSnapshotKey = generateKeyPair(config.KEY_TYPE);
    const directorTimestampKey = generateKeyPair(config.KEY_TYPE);

    // create initial root.json for TUF repos, we'll start them off at 1
    const version = 1;

    // generate directory repo root.json
    const directorRepoRoot = generateRoot(config.TUF_TTL.DIRECTOR.ROOT,
        version,
        directorRootKey,
        directorTargetsKey,
        directorSnapshotKey,
        directorTimestampKey
    );

    // generate image repo root.json
    const imageRepoRoot = generateRoot(config.TUF_TTL.IMAGE.ROOT,
        version,
        imageRootKey,
        imageTargetsKey,
        imageSnapshotKey,
        imageTimestampKey
    );


    // do persistance layer operations in a transaction
    const namespace = await prisma.$transaction(async tx => {

        // create namespace in db
        const namespace = await tx.namespace.create({
            data: {}
        });

        // create image repo root.json in db
        await tx.metadata.create({
            data: {
                namespace_id: namespace.id,
                repo: TUFRepo.image,
                role: TUFRole.root,
                version,
                value: imageRepoRoot as object,
                expires_at: imageRepoRoot.signed.expires
            }
        });

        // create director repo root.json in db
        await tx.metadata.create({
            data: {
                namespace_id: namespace.id,
                repo: TUFRepo.director,
                role: TUFRole.root,
                version,
                value: directorRepoRoot as object,
                expires_at: directorRepoRoot.signed.expires
            }
        });

        // create bucket in blob storage
        await blobStorage.createBucket(namespace.id);

        // store image repo private keys
        await keyStorage.putKey(`${namespace.id}-image-root-private`, imageRootKey.privateKey);
        await keyStorage.putKey(`${namespace.id}-image-targets-private`, imageTargetsKey.privateKey);
        await keyStorage.putKey(`${namespace.id}-image-snapshot-private`, imageSnapshotKey.privateKey);
        await keyStorage.putKey(`${namespace.id}-image-timestamp-private`, imageTimestampKey.privateKey);

        // store image repo public keys
        await keyStorage.putKey(`${namespace.id}-image-root-public`, imageRootKey.publicKey);
        await keyStorage.putKey(`${namespace.id}-image-targets-public`, imageTargetsKey.publicKey);
        await keyStorage.putKey(`${namespace.id}-image-snapshot-public`, imageSnapshotKey.publicKey);
        await keyStorage.putKey(`${namespace.id}-image-timestamp-public`, imageTimestampKey.publicKey);

        // store director repo private keys
        await keyStorage.putKey(`${namespace.id}-director-root-private`, directorRootKey.privateKey);
        await keyStorage.putKey(`${namespace.id}-director-targets-private`, directorTargetsKey.privateKey);
        await keyStorage.putKey(`${namespace.id}-director-snapshot-private`, directorSnapshotKey.privateKey);
        await keyStorage.putKey(`${namespace.id}-director-timestamp-private`, directorTimestampKey.privateKey);

        // store director repo public keys
        await keyStorage.putKey(`${namespace.id}-director-root-public`, directorRootKey.publicKey);
        await keyStorage.putKey(`${namespace.id}-director-targets-public`, directorTargetsKey.publicKey);
        await keyStorage.putKey(`${namespace.id}-director-snapshot-public`, directorSnapshotKey.publicKey);
        await keyStorage.putKey(`${namespace.id}-director-timestamp-public`, directorTimestampKey.publicKey);

        return namespace;

    });

    const response = {
        id: namespace.id,
        created_at: namespace.created_at,
        updated_at: namespace.updated_at
    };

    logger.info('created a namespace');
    return res.status(200).json(response);

});


/**
 * List namespaces
 */
router.get('/namespaces', async (req, res) => {

    const namespaces = await prisma.namespace.findMany({
        orderBy: {
            created_at: 'desc'
        }
    });

    const response = namespaces.map(namespace => ({
        id: namespace.id,
        created_at: namespace.created_at,
        updated_at: namespace.updated_at
    }))

    return res.status(200).json(response);

});


/**
 * Delete a namespace
 * 
 * - Deletes namespace in db, this cascades to all resources.
 * - Deletes bucket and all objects in blob storage.
 * - Deletes keys, images and treehub objects associated with this namespace.
 * 
 * TODO
 * - delete all keys associated with ecus in this namespace.
 */
router.delete('/namespaces/:namespace', async (req, res) => {

    const namespace = req.params.namespace;

    const namespaceCount = await prisma.namespace.count({
        where: {
            id: namespace
        }
    });

    if (namespaceCount === 0) {
        logger.warn('could not delete a namespace because it does not exist');
        return res.status(400).send('could not delete namespace');
    }

    await prisma.$transaction(async tx => {

        // delete namespace in db
        await tx.namespace.delete({
            where: {
                id: namespace
            }
        });

        // deletes bucket in blob storage
        await blobStorage.deleteBucket(namespace);

        await keyStorage.deleteKey(`${namespace}-image-root-private`);
        await keyStorage.deleteKey(`${namespace}-image-targets-private`);
        await keyStorage.deleteKey(`${namespace}-image-snapshot-private`);
        await keyStorage.deleteKey(`${namespace}-image-timestamp-private`);

        await keyStorage.deleteKey(`${namespace}-image-root-public`);
        await keyStorage.deleteKey(`${namespace}-image-targets-public`);
        await keyStorage.deleteKey(`${namespace}-image-snapshot-public`);
        await keyStorage.deleteKey(`${namespace}-image-timestamp-public`);

        await keyStorage.deleteKey(`${namespace}-director-root-private`);
        await keyStorage.deleteKey(`${namespace}-director-targets-private`);
        await keyStorage.deleteKey(`${namespace}-director-snapshot-private`);
        await keyStorage.deleteKey(`${namespace}-director-timestamp-private`);

        await keyStorage.deleteKey(`${namespace}-director-root-public`);
        await keyStorage.deleteKey(`${namespace}-director-targets-public`);
        await keyStorage.deleteKey(`${namespace}-director-snapshot-public`);
        await keyStorage.deleteKey(`${namespace}-director-timestamp-public`);

    });

    logger.info('deleted a namespace');
    return res.status(200).send('namespace deleted');

});


/**
 * Create a provisioning credentials
 * 
 * TODO
 * - catch archive on error event
 * - record credentials creation in db to enable revocation, expiry, auditing, etc.
 */
router.get('/namespaces/:namespace/provisioning-credentials', async (req, res) => {

    const namespace = req.params.namespace;

    const namespaceCount = await prisma.namespace.count({
        where: {
            id: namespace
        }
    });

    if (namespaceCount === 0) {
        logger.warn('could not create provisioning key because namespace does not exist');
        return res.status(400).send('could not create provisioning key');
    }

    // create provisioning key, this will not be stored
    const provisioningKeyPair = forge.pki.rsa.generateKeyPair(2048);

    // load root ca and key, used to sign provisioning cert
    const rootCaPrivateKeyStr = await keyStorage.getKey(RootCAPrivateKeyId);
    const rootCaPublicKeyStr = await keyStorage.getKey(RootCAPublicKeyId);
    const rootCaCertStr = await blobStorage.getObject(RootCABucket, RootCACertObjId) as string;
    const rootCaCert = forge.pki.certificateFromPem(rootCaCertStr);

    // generate provisioning cert using root ca as parent
    const opts = {
        commonName: namespace,
        cert: rootCaCert,
        keyPair: {
            privateKey: forge.pki.privateKeyFromPem(rootCaPrivateKeyStr),
            publicKey: forge.pki.publicKeyFromPem(rootCaPublicKeyStr)
        }
    };
    const provisioningCert = generateCertificate(provisioningKeyPair, opts);

    // bundle into pcks12, no encryption password set
    const p12 = forge.pkcs12.toPkcs12Asn1(provisioningKeyPair.privateKey, [provisioningCert, rootCaCert], null, { algorithm: 'aes256' });

    // create credentials.zip
    const archive = archiver('zip');

    archive.append(Buffer.from(forge.asn1.toDer(p12).getBytes(), 'binary'), { name: 'autoprov_credentials.p12' });
    archive.finalize();

    logger.info('provisioning credentials have been created');

    res.status(200);
    archive.pipe(res);

});


/**
 * Create a rollout.
 * 
 * Creates an association betwen an ecu and image.
 */
router.post('/namespaces/:namespace/rollouts', async (req, res) => {

    const {
        ecu_id,
        image_id
    } = req.body;


    const namespace_id = req.params.namespace;

    // check namespace exists
    const namespaceCount = await prisma.namespace.count({
        where: {
            id: namespace_id
        }
    });

    if (namespaceCount === 0) {
        logger.warn('could not create a rollout because namespace does not exist');
        return res.status(400).send('could not create rollout');
    }

    // check robot exists
    const ecuCount = await prisma.ecu.count({
        where: {
            id: ecu_id
        }
    });

    if (ecuCount === 0) {
        logger.warn('could not create a rollout because ecu does not exist');
        return res.status(400).send('could not create rollout');
    }

    // check image exists
    const imageCount = await prisma.image.count({
        where: {
            id: image_id
        }
    });

    if (imageCount === 0) {
        logger.warn('could not create a rollout because image does not exist');
        return res.status(400).send('could not create rollout');
    }

    const tmpRollout = await prisma.tmpEcuImages.create({
        data: {
            image_id,
            ecu_id
        }
    });

    const response = {
        image_id: tmpRollout.image_id,
        ecu_id: tmpRollout.ecu_id,
        created_at: tmpRollout.created_at,
        updated_at: tmpRollout.updated_at
    };

    logger.info('created tmp rollout');
    return res.status(200).json(response);

});



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
 * - upload type of image along with the image - ostree, binary, etc
 * - also included could be the name of the image
 */
router.post('/:namespace/images', express.raw({ type: '*/*' }), async (req, res) => {

    const namespace_id = req.params.namespace;
    const imageContent = req.body;
    const hwids = (req.query.hwids as string).split(',');

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

    // get image id and hashes
    const imageId = uuidv4();
    const sha256 = generateHash(imageContent, { algorithm: 'SHA256' });
    const sha512 = generateHash(imageContent, { algorithm: 'SHA512' });

    // get new versions
    const newTargetsVersion = await getLatestMetadataVersion(namespace_id, TUFRepo.image, TUFRole.targets) + 1;
    const newSnapshotVersion = await getLatestMetadataVersion(namespace_id, TUFRepo.image, TUFRole.snapshot) + 1;
    const newTimestampVersion = await getLatestMetadataVersion(namespace_id, TUFRepo.image, TUFRole.timestamp) + 1;

    // read in keys from key storage
    const targetsKeyPair = await loadKeyPair(namespace_id, TUFRepo.image, TUFRole.targets);
    const snapshotKeyPair = await loadKeyPair(namespace_id, TUFRepo.image, TUFRole.snapshot);
    const timestampKeyPair = await loadKeyPair(namespace_id, TUFRepo.image, TUFRole.timestamp);

    // assemble information about this image to be put in the targets.json metadata
    // we grab the previous targets portion of the targets metadata if it exists and 
    // append this new iamge to it, otherwise we start with an empty object
    const latestTargets = await getLatestMetadata(namespace_id, TUFRepo.image, TUFRole.targets);

    const targetsImages: ITargetsImages = latestTargets ? latestTargets.signed.targets : {};

    targetsImages[imageId] = {
        custom: {
            hardwareIds: hwids,
            targetFormat: ETargetFormat.Binary, // ostree is not supported as of now
            uri: `${config.ROBOT_GATEWAY_HOSTNAME}/api/v0/robot/repo/images/${imageId}`
        },
        length: size,
        hashes: {
            sha256,
            sha512
        }
    };

    // generate new set of tuf metadata (apart from root)
    const targetsMetadata = generateTargets(config.TUF_TTL.IMAGE.TARGETS, newTargetsVersion, targetsKeyPair, targetsImages);
    const snapshotMetadata = generateSnapshot(config.TUF_TTL.IMAGE.SNAPSHOT, newSnapshotVersion, snapshotKeyPair, targetsMetadata);
    const timestampMetadata = generateTimestamp(config.TUF_TTL.IMAGE.TIMESTAMP, newTimestampVersion, timestampKeyPair, snapshotMetadata);

    // perform db writes in transaction
    try {
        const image = await prisma.$transaction(async tx => {

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
                    expires_at: snapshotMetadata.signed.expires
                }
            });

            await tx.metadata.create({
                data: {
                    namespace_id,
                    repo: TUFRepo.image,
                    role: TUFRole.timestamp,
                    version: newTimestampVersion,
                    value: timestampMetadata as object,
                    expires_at: timestampMetadata.signed.expires
                }
            });

            // create reference to image in db
            await tx.image.create({
                data: {
                    id: imageId,
                    namespace_id,
                    size,
                    hwids,
                    sha256,
                    sha512,
                    status: UploadStatus.uploading
                }
            });

            // upload image to blob storage
            await blobStorage.putObject(namespace_id, `images/${imageId}`, imageContent);

            // update reference to image in db saying that it has completed uploading
            const image = await tx.image.update({
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

            return image;

        });

        const response = {
            id: image.id,
            size: image.size,
            sha256: image.sha256,
            sha512: image.sha512,
            hwids: image.hwids,
            status: image.status,
            created_at: image.created_at,
            updated_at: image.updated_at
        };

        logger.info('uploaded an image');
        return res.status(200).json(response);

    } catch (error) {
        if (error.code === 'P2002') {
            logger.warn('could not upload image because an image with this hash already exists');
            return res.status(400).send('could not upload image');
        }
        throw error;

    }

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
        hwids: image.hwids,
        status: image.status,
        created_at: image.created_at,
        updated_at: image.updated_at
    }));

    return res.status(200).json(response);

});



/**
 * List robots in a namespace.
 */
router.get('/:namespace/robots', async (req, res) => {

    const namespace_id = req.params.namespace;

    // check namespace exists
    const namespaceCount = await prisma.namespace.count({
        where: {
            id: namespace_id
        }
    });

    if (namespaceCount === 0) {
        logger.warn('could not list robots because namespace does not exist');
        return res.status(400).send('could not list robots');
    }

    // get robots
    const robots = await prisma.robot.findMany({
        where: {
            namespace_id
        },
        orderBy: {
            created_at: 'desc'
        }
    });

    const response = robots.map(robot => ({
        id: robot.id,
        created_at: robot.created_at,
        updated_at: robot.updated_at
    }));

    return res.status(200).json(response);

});


/**
 * Get detailed info about a robot in a namespace.
 */
router.get('/:namespace/robots/:robot_id', async (req, res) => {

    const namespace_id = req.params.namespace;
    const robot_id = req.params.robot_id;

    // get robot
    const robot = await prisma.robot.findUnique({
        where: {
            namespace_id_id: {
                namespace_id,
                id: robot_id
            }
        },
        include: {
            ecus: {
                orderBy: {
                    created_at: 'desc'
                }
            },
            robot_manifests: {
                take: 10,
                orderBy: {
                    created_at: 'desc'
                }
            }
        }
    });

    if (!robot) {
        logger.warn('could not get info about robot because it or the namespace does not exist');
        return res.status(400).send('could not get robot');
    }

    const response = {
        id: robot.id,
        created_at: robot.created_at,
        updated_at: robot.updated_at,
        robot_manifests: robot.robot_manifests.map(manifest => ({
            id: manifest.id,
            created_at: manifest.created_at
        })),
        ecus: robot.ecus.map(ecu => ({
            id: ecu.id,
            created_at: ecu.created_at,
            updated_at: ecu.updated_at,
        }))
    };

    return res.status(200).json(response);

});


/**
 * Delete a robot
 * 
 * TODO
 * - delete all associated ecu keys
 */
router.delete('/:namespace/robots/:robot_id', async (req, res) => {

    const namespace_id = req.params.namespace;
    const robot_id = req.params.robot_id;

    // try delete robot
    try {

        await prisma.robot.delete({
            where: {
                namespace_id_id: {
                    namespace_id,
                    id: robot_id
                }
            }
        });

        logger.info('deleted a robot');
        return res.status(200).send('deleted robot');

    } catch (error) {
        // catch deletion failure error code
        // someone has tried to create a robot that does not exist in this namespace, return 400
        if (error.code === 'P2025') {
            logger.warn('could not delete a robot because it does not exist');
            return res.status(400).send('could not delete robot');
        }
        // otherwise we dont know what happened so re-throw the errror and let the
        // general error catcher return it as a 500
        throw error;
    }

});




export default router;
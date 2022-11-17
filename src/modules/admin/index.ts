import express from 'express';
import { prisma } from '../../core/postgres';
import config from '../../config';
import { generateKeyPair } from '../../core/crypto';
import { keyStorage } from '../../core/key-storage';
import { blobStorage } from '../../core/blob-storage';
import { generateRoot } from '../../core/tuf';
import { TUFRepo, TUFRole } from '@prisma/client';

const router = express.Router();


/**
 * Initialises a namespace
 * 
 * - Creates namespace in db.
 * - Generates online private keys (these will be replaced by offline keys in time).
 * - Creates image repo root.json and saves it to db.
 */
router.post('/namespaces', async (req, res) => {

    // generate 8 key pairs, 4 top-level metadata keys for 2 repos
    const imageRootKey = generateKeyPair(config.KEY_TYPE);
    const imageTargetsKey = generateKeyPair(config.KEY_TYPE);
    const imageSnapshotKey = generateKeyPair(config.KEY_TYPE);
    const imageTimestampKey = generateKeyPair(config.KEY_TYPE);

    const directorRootKey = generateKeyPair(config.KEY_TYPE);
    const directorTargetsKey = generateKeyPair(config.KEY_TYPE);
    const directorSnapshotKey = generateKeyPair(config.KEY_TYPE);
    const directorTimestampKey = generateKeyPair(config.KEY_TYPE);

    // create initial root.json for image repo, we'll start it off at 1
    const version = 1;

    // generate image repo root.json
    const imageRepoRoot = generateRoot(config.TUF_TTL.IMAGE.ROOT,
        version,
        imageRootKey,
        imageTargetsKey,
        imageSnapshotKey,
        imageTimestampKey
    ) as object;

    // generate directory repo root.json
    const directorRepoRoot = generateRoot(config.TUF_TTL.DIRECTOR.ROOT,
        version,
        directorRootKey,
        directorTargetsKey,
        directorSnapshotKey,
        directorTimestampKey
    ) as object;


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
                value: imageRepoRoot
            }
        });

        // create director repo root.json in db
        await tx.metadata.create({
            data: {
                namespace_id: namespace.id,
                repo: TUFRepo.director,
                role: TUFRole.root,
                version,
                value: directorRepoRoot
            }
        });
        

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
 * - Deletes keys, images and treehub objects associated with this namespace.
 */
router.delete('/namespaces/:namespace', async (req, res) => {

    const namespace = req.params.namespace;

    const namespaceCount = await prisma.namespace.count({
        where: {
            id: namespace
        }
    });

    if (namespaceCount === 0) {
        return res.status(400).send('could not delete namespace');
    }

    await prisma.$transaction(async tx => {

        // delete namespace in db
        const namespaceObj = await prisma.namespace.delete({
            where: {
                id: namespace
            },
            include: {
                objects: true,
                images: true
            }
        });

        // delete ostree objects in blob storage associated with this namespace.
        // get the bucket id from all objects stored under this namespace, which depends on whether it is a summary object or not
        const treehubBucketIds = namespaceObj!.objects.map(object => {
            if (object.object_id === 'summary') {
                return `${object.namespace_id}/${object.object_id}`
            } else {
                return `${object.namespace_id}/${object.object_id.substring(0, 2)}/${object.object_id.substring(2)}`
            }
        });

        for await (const bucketId of treehubBucketIds) {
            await blobStorage.deleteObject(bucketId);
        }

        // delete images in image repo associated with this namespace.
        const imageBucketIds = namespaceObj.images.map(image => image.id);

        for await (const bucketId of imageBucketIds) {
            await blobStorage.deleteObject(bucketId);
        }

        // delete keys associated with this namespace
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

    return res.status(200).send('namespace deleted');

});



export default router;
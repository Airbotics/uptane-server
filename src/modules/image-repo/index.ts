import express, { Request } from 'express';
import { TUFRepo, TUFRole, Prisma, UploadStatus, ImageFormat } from '@prisma/client';
import config from '@airbotics-config';
import { blobStorage } from '@airbotics-core/blob-storage';
import { prisma } from '@airbotics-core/postgres';
import { logger } from '@airbotics-core/logger';
import { ensureRobotAndNamespace } from '@airbotics-middlewares';
import { generateHash } from '@airbotics-core/crypto';
import { toCanonical } from '@airbotics-core/utils';
import { EHashDigest } from '@airbotics-core/consts';
import { dayjs } from '@airbotics-core/time';
import { ISignedTargetsTUF } from 'src/types';
import { loadKeyPair } from '@airbotics-core/key-storage';
import { generateSignedSnapshot, generateSignedTimestamp, getLatestMetadata, getLatestMetadataVersion } from '@airbotics-core/tuf';


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

    // FIND image WHERE namespace = namespace AND image_id = image_id AND sha256 = hash
    const image = await prisma.image.findFirst({
        where: {
            AND: [
                { namespace_id },
                { id },
                { sha256: hash }
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


/**
 * Upload targets.json signed by offline key
 * 
 * TODO: 
 * - fix untidy url structure, put namespace id in header
 * - return checksum
 * - validate sent checksum
 * - validate sent targets.json
 */
router.put('/:namespace/api/v1/user_repo/targets', async (req, res) => {

    const checksum = req.header('x-ats-role-checksum');
    const targetsMetadata = req.body as ISignedTargetsTUF;
    const namespace_id = req.params.namespace;

    // get most recently created target
    let mostRecentTargetKey: string | null = null;
    let mostRecentTarget: any = null;

    const targets = targetsMetadata.signed.targets

    for (const targetKey in targets) {
        if (!mostRecentTarget) {
            mostRecentTargetKey = targetKey;
            mostRecentTarget = targets[targetKey];
        } else if (dayjs(targets[targetKey].custom.createdAt).isAfter(dayjs(mostRecentTarget.custom.createdAt))) {
            mostRecentTargetKey = targetKey;
            mostRecentTarget = targets[targetKey];
        }
    }

    const snapshotKeyPair = await loadKeyPair(namespace_id, TUFRepo.image, TUFRole.snapshot);
    const timestampKeyPair = await loadKeyPair(namespace_id, TUFRepo.image, TUFRole.timestamp);

    const newTargetsVersion = targetsMetadata.signed.version
    const newSnapshotVersion = await getLatestMetadataVersion(namespace_id, TUFRepo.image, TUFRole.snapshot) + 1;
    const newTimestampVersion = await getLatestMetadataVersion(namespace_id, TUFRepo.image, TUFRole.timestamp) + 1;

    const snapshotMetadata = generateSignedSnapshot(config.TUF_TTL.IMAGE.SNAPSHOT, newSnapshotVersion, snapshotKeyPair, targetsMetadata);
    const timestampMetadata = generateSignedTimestamp(config.TUF_TTL.IMAGE.TIMESTAMP, newTimestampVersion, timestampKeyPair, snapshotMetadata);

    // perform db writes in transaction
    await prisma.$transaction(async tx => {

        await tx.image.create({
            data: {
                namespace_id,
                name: mostRecentTarget.custom.name,
                size: 0,
                hwids: mostRecentTarget.custom.hardwareIds,
                sha256: mostRecentTarget.hashes.sha256,
                status: UploadStatus.uploaded,
                format: ImageFormat.ostree
            }
        });

        // create tuf metadata
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

    });

    return res.status(200).end();

})

/**
 * Get targets for offline signing.
 * 
 * TODO: fix untidy url structure, put namespace id in header
 */
router.get('/:namespace/api/v1/user_repo/targets.json', async (req, res) => {

    const namespace = req.params.namespace;

    const latest = await getLatestMetadata(namespace, TUFRepo.image, TUFRole.targets);

    if (!latest) {
        logger.warn('trying to download latest targets metadata for image but it does not exist');
        return res.status(500).end();
    }

    const targetscheckSum = generateHash(toCanonical(latest as object), { hashDigest: EHashDigest.Sha256 });

    res.set('x-ats-role-checksum', targetscheckSum);
    return res.status(200).send(latest);

});


export default router;
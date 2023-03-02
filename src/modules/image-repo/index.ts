import express, { Request } from 'express';
import { TUFRepo, TUFRole, UploadStatus, ImageFormat } from '@prisma/client';
import config from '@airbotics-config';
import { prisma } from '@airbotics-core/drivers';
import { logger } from '@airbotics-core/logger';
import { mustBeRobot, updateRobotMeta, validate } from '@airbotics-middlewares';
import { generateHash, verifySignature } from '@airbotics-core/crypto';
import { getKeyStorageRepoKeyId, toCanonical } from '@airbotics-core/utils';
import { EEventAction, EEventActorType, EEventResource, EHashDigest, ESignatureScheme, EValidationSource, TUF_METADATA_LATEST } from '@airbotics-core/consts';
import { dayjs } from '@airbotics-core/time';
import { ISignedTargetsTUF } from '@airbotics-types';
import { keyStorage } from '@airbotics-core/key-storage';
import { generateSignedSnapshot, generateSignedTimestamp, getTufMetadata, getLatestMetadataVersion } from '@airbotics-core/tuf';
import { targetsSchema } from './schemas';
import { auditEvent } from '@airbotics-core/events';

const router = express.Router();


/**
 * Fetch a specific version of the root tuf metadata.
 * 
 * TODO:
 * - handle if it is outdated.
 */
router.get('/:version.root.json', mustBeRobot, async (req: Request, res) => {

    const version = Number(req.params.version);
    const { team_id } = req.robotGatewayPayload!;

    const metadata = await getTufMetadata(team_id, TUFRepo.image, TUFRole.root, version);

    if (!metadata) {
        logger.warn('a robot is trying to get a tuf metadata role that does not exist')
        return res.status(404).end();
    }

    const checkSum = generateHash(toCanonical(metadata as object), { hashDigest: EHashDigest.Sha256 });

    res.set('x-ats-role-checksum', checkSum);
    return res.status(200).send(metadata);

});


/**
 * Fetch the latest version of the some tuf metadata role.
 * 
 * TODO:
 * - handle if it is outdated.
 */
router.get('/:role.json', mustBeRobot, updateRobotMeta, async (req: Request, res) => {

    const role = req.params.role as TUFRole;
    const { team_id } = req.robotGatewayPayload!;

    const metadata = await getTufMetadata(team_id, TUFRepo.image, role, TUF_METADATA_LATEST);

    if (!metadata) {
        logger.warn('a robot is trying to get a tuf metadata role that does not exist')
        return res.status(404).end();
    }

    const checkSum = generateHash(toCanonical(metadata as object), { hashDigest: EHashDigest.Sha256 });

    res.set('x-ats-role-checksum', checkSum);
    return res.status(200).send(metadata);

});


/**
 * Upload targets.json signed by offline key.
 * 
 * Notes:
 * - the size of the targets.json file isn't taken into consideration.
 * 
 * TODO: 
 * - fix untidy url structure, put team id in header
 * - set image size
 * - update ostree commit and ref
 */
router.put('/:team_id/api/v1/user_repo/targets', validate(targetsSchema, EValidationSource.Body), async (req, res) => {

    const clientChecksum = req.header('x-ats-role-checksum');
    const clientTargetsMetadata = req.body as ISignedTargetsTUF;
    const team_id = req.params.team_id;

    // validate checksum
    const mostRecentTargetMetadata = await getTufMetadata(team_id, TUFRepo.image, TUFRole.targets, TUF_METADATA_LATEST);
    const targetsCheckSum = generateHash(toCanonical(mostRecentTargetMetadata as object), { hashDigest: EHashDigest.Sha256 });

    if (targetsCheckSum !== clientChecksum) {
        logger.warn('a client is trying to upload a targets.json whose checksum is incorrect');
        return res.status(412).json({ code: 'role_checksum_mismatch' });
    }


    // validate signature
    // assuming only one signature is sent and rsa keys are used
    const targetsKeyPair = await keyStorage.getKeyPair(getKeyStorageRepoKeyId(team_id, TUFRepo.image, TUFRole.targets));

    const verified = verifySignature(
        toCanonical(clientTargetsMetadata.signed),
        clientTargetsMetadata.signatures[0].sig,
        targetsKeyPair.publicKey,
        { signatureScheme: ESignatureScheme.RsassaPssSha256 }
    );

    if (!verified) {
        logger.warn('a client is trying to upload a targets.json whose signature is incorrect');
        return res.status(400).json({ code: 'invalid_signature' });
    }

    // get most recently created target
    let mostRecentTargetKey: string | null = null;
    let mostRecentTarget: any = null;

    const targets = clientTargetsMetadata.signed.targets;

    for (const targetKey in targets) {
        if (!mostRecentTarget) {
            mostRecentTargetKey = targetKey;
            mostRecentTarget = targets[targetKey];
        }
        else if (dayjs(targets[targetKey].custom.createdAt).isAfter(dayjs(mostRecentTarget.custom.createdAt))) {
            mostRecentTargetKey = targetKey;
            mostRecentTarget = targets[targetKey];
        }
    }

    // check this image hasn't been created before
    const exists = await prisma.image.findUnique({
        where: {
            id: mostRecentTargetKey!
        }
    });

    if (exists) {
        logger.warn('a client is trying to upload an image that already exists');
        return res.status(400).end();
    }

    const snapshotKeyPair = await keyStorage.getKeyPair(getKeyStorageRepoKeyId(team_id, TUFRepo.image, TUFRole.snapshot));
    const timestampKeyPair = await keyStorage.getKeyPair(getKeyStorageRepoKeyId(team_id, TUFRepo.image, TUFRole.timestamp));

    const newTargetsVersion = clientTargetsMetadata.signed.version;
    const newSnapshotVersion = await getLatestMetadataVersion(team_id, TUFRepo.image, TUFRole.snapshot) + 1;
    const newTimestampVersion = await getLatestMetadataVersion(team_id, TUFRepo.image, TUFRole.timestamp) + 1;

    const snapshotMetadata = generateSignedSnapshot(config.TUF_TTL.IMAGE.SNAPSHOT, newSnapshotVersion, snapshotKeyPair, clientTargetsMetadata);
    const timestampMetadata = generateSignedTimestamp(config.TUF_TTL.IMAGE.TIMESTAMP, newTimestampVersion, timestampKeyPair, snapshotMetadata);

    // ostree
    // target version is supposed to be equal to ostree commit hash
    // const object = await prisma.object.findUnique({
    //     where: {
    //         team_id_object_id: {
    //             team_id,
    //             object_id: `${mostRecentTarget.custom.version}.commit`
    //         } 
    //     },
    //     include: {
    //         refs: true
    //     }
    // });

    // if(!object) {
    //     return res.status(400).end();
    // }

    // perform db writes in transaction
    await prisma.$transaction(async tx => {

        const image = await tx.image.create({
            data: {
                team_id,
                id: mostRecentTargetKey!,
                name: mostRecentTarget.custom.name,
                size: 0,
                hwids: mostRecentTarget.custom.hardwareIds,
                sha256: mostRecentTarget.hashes.sha256,
                status: UploadStatus.uploaded,
                format: ImageFormat.ostree
            }
        });

        // create tuf metadata
        await tx.tufMetadata.create({
            data: {
                team_id,
                repo: TUFRepo.image,
                role: TUFRole.targets,
                version: newTargetsVersion,
                value: clientTargetsMetadata as object,
                expires_at: clientTargetsMetadata.signed.expires
            }
        });

        await tx.tufMetadata.create({
            data: {
                team_id,
                repo: TUFRepo.image,
                role: TUFRole.snapshot,
                version: newSnapshotVersion,
                value: snapshotMetadata as object,
                expires_at: snapshotMetadata.signed.expires
            }
        });

        await tx.tufMetadata.create({
            data: {
                team_id,
                repo: TUFRepo.image,
                role: TUFRole.timestamp,
                version: newTimestampVersion,
                value: timestampMetadata as object,
                expires_at: timestampMetadata.signed.expires
            }
        });

        auditEvent.emit({
            resource: EEventResource.Image,
            action: EEventAction.Created,
            actor_type: EEventActorType.User,
            actor_id: null,
            team_id: team_id,
            meta: {
                image_id: image.id,
                name: mostRecentTarget.custom.name,
                format: ImageFormat.ostree,
                sha256: mostRecentTarget.hashes.sha256
            }
        });

    });

    logger.info('a new image has been created')
    res.set('x-ats-role-checksum', targetsCheckSum);
    res.set('x-ats-targets-role-size-limit', String(config.TUF_TARGETS_FILE_SIZE_LIMIT));

    return res.status(200).end();

});


/**
 * Get targets for offline signing.
 * 
 * TODO: fix untidy url structure, put team id in header
 */
router.get('/:team_id/api/v1/user_repo/targets.json', async (req, res) => {

    const teamID = req.params.team_id;

    const latest = await getTufMetadata(teamID, TUFRepo.image, TUFRole.targets, TUF_METADATA_LATEST);

    if (!latest) {
        logger.warn('trying to download latest targets metadata for image but it does not exist');
        return res.status(500).end();
    }

    const targetscheckSum = generateHash(toCanonical(latest as object), { hashDigest: EHashDigest.Sha256 });

    res.set('x-ats-role-checksum', targetscheckSum);
    return res.status(200).send(latest);

});


export default router;
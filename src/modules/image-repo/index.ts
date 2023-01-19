import express, { Request } from 'express';
import { TUFRepo, TUFRole, UploadStatus, ImageFormat } from '@prisma/client';
import config from '@airbotics-config';
import { prisma } from '@airbotics-core/drivers';
import { logger } from '@airbotics-core/logger';
import { mustBeRobot, updateRobotMeta, validate } from '@airbotics-middlewares';
import { generateHash, verifySignature } from '@airbotics-core/crypto';
import { getKeyStorageRepoKeyId, toCanonical } from '@airbotics-core/utils';
import { EHashDigest, ESignatureScheme, EValidationSource, TUF_METADATA_LATEST } from '@airbotics-core/consts';
import { dayjs } from '@airbotics-core/time';
import { ISignedTargetsTUF } from '@airbotics-types';
import { keyStorage } from '@airbotics-core/key-storage';
import { generateSignedSnapshot, generateSignedTimestamp, getTufMetadata, getLatestMetadataVersion } from '@airbotics-core/tuf';
import { targetsSchema } from './schemas';


const router = express.Router();


/**
 * Fetch a specific version of the root tuf metadata.
 * 
 * TODO:
 * - handle if it is outdated.
 */
router.get('/:version.root.json', mustBeRobot, updateRobotMeta, async (req: Request, res) => {

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
 * - image size is 0
 * - update ostree commit and ref
 */
router.put('/:team_id/api/v1/user_repo/targets', validate(targetsSchema, EValidationSource.Body), async (req, res) => {

    const clientChecksum = req.header('x-ats-role-checksum');
    const clientTargetsMetadata = req.body as ISignedTargetsTUF;
    const team_id = req.params.team_id;

    // validate checksum
    const targetsCheckSum = generateHash(toCanonical(clientTargetsMetadata), { hashDigest: EHashDigest.Sha256 });

    if (targetsCheckSum !== clientChecksum) {
        logger.warn('a client is trying to upload a targets.json whose checksum is incorrect');
        return res.status(412).json({ code: 'role_checksum_mismatch' });
    }

    // validate signature
    // assuming only one signature is sent and rsa keys are used
    const targetsKeyPair = await keyStorage.getKeyPair(getKeyStorageRepoKeyId(team_id, TUFRepo.image, TUFRole.targets));

    const verified = verifySignature(toCanonical(clientTargetsMetadata), clientTargetsMetadata.signatures[0].sig, targetsKeyPair.publicKey, { signatureScheme: ESignatureScheme.RsassaPssSha256 });

    if (!verified) {
        logger.warn('a client is trying to upload a targets.json whose checksum is incorrect');
        return res.status(412).json({ code: 'role_checksum_mismatch' });
    }

    // get most recently created target
    let mostRecentTargetKey: string | null = null;
    let mostRecentTarget: any = null;

    const targets = clientTargetsMetadata.signed.targets;

    for (const targetKey in targets) {
        if (!mostRecentTarget) {
            mostRecentTargetKey = targetKey;
            mostRecentTarget = targets[targetKey];
        } else if (dayjs(targets[targetKey].custom.createdAt).isAfter(dayjs(mostRecentTarget.custom.createdAt))) {
            mostRecentTargetKey = targetKey;
            mostRecentTarget = targets[targetKey];
        }
    }

    const snapshotKeyPair = await keyStorage.getKeyPair(getKeyStorageRepoKeyId(team_id, TUFRepo.image, TUFRole.snapshot));
    const timestampKeyPair = await keyStorage.getKeyPair(getKeyStorageRepoKeyId(team_id, TUFRepo.image, TUFRole.timestamp));

    const newTargetsVersion = clientTargetsMetadata.signed.version;
    const newSnapshotVersion = await getLatestMetadataVersion(team_id, TUFRepo.image, TUFRole.snapshot) + 1;
    const newTimestampVersion = await getLatestMetadataVersion(team_id, TUFRepo.image, TUFRole.timestamp) + 1;

    const snapshotMetadata = generateSignedSnapshot(config.TUF_TTL.IMAGE.SNAPSHOT, newSnapshotVersion, snapshotKeyPair, clientTargetsMetadata);
    const timestampMetadata = generateSignedTimestamp(config.TUF_TTL.IMAGE.TIMESTAMP, newTimestampVersion, timestampKeyPair, snapshotMetadata);

    // perform db writes in transaction
    await prisma.$transaction(async tx => {

        await tx.image.create({
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

    });

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
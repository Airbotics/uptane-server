import { Request, Response, NextFunction } from 'express';

import { EHashDigest} from '@airbotics-core/consts';
import { SuccessJsonResponse, NoContentResponse } from '@airbotics-core/network/responses';
import { logger } from '@airbotics-core/logger';
import prisma from '@airbotics-core/postgres';
import { generateHash } from '@airbotics-core/crypto';
import config from '@airbotics-config';
import { generateSignedSnapshot, generateSignedTargets, generateSignedTimestamp, getLatestMetadata, getLatestMetadataVersion } from '@airbotics-core/tuf';
import { ImageFormat, TUFRepo, TUFRole, UploadStatus } from '@prisma/client';
import { blobStorage } from '@airbotics-core/blob-storage';
import { loadKeyPair } from '@airbotics-core/key-storage';
import { v4 as uuidv4 } from 'uuid';



/**
 * Upload an image in a team.
 * 
 * This is not an upsert operation, you cannot overwrite an image once it has been uploaded.
 * You can only upload one image/target at a time.
 * 
 * For now this adds the image to blob storage but will later upload to treehub, it also signs 
 * the appropiate TUF metadata, and updates the inventory db (i.e. postgres)
 * 
 * OPERATIONS:
 * - Checks team exists.
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
export const createImage = async (req: Request, res: Response, next: NextFunction) => {
    
    const teamID = req.headers['air-team-id']!;
    const imageContent = req.body;
    const hwids = (req.query.hwids as string).split(',');
    const format = req.query.type as ImageFormat;
    const name = req.query.name as string;

    const size = parseInt(req.get('content-length')!);

    // if content-length was not sent, or it is zero, or it is not a number return 400
    if (!size || size === 0 || isNaN(size)) {
        logger.warn('could not create an image because content-length header was not sent');
        return res.status(400).end();
    }

    // check team exists
    const teamCount = await prisma.team.count({
        where: {
            id: teamID
        }
    });

    if (teamCount === 0) {
        logger.warn('could not create an image because team does not exist');
        return res.status(400).send('could not upload image');
    }

    // get image id and hashes
    const imageId = uuidv4();
    const sha256 = generateHash(imageContent, { hashDigest: EHashDigest.Sha256 });

    // determine new version numbers
    const newTargetsVersion = await getLatestMetadataVersion(teamID, TUFRepo.image, TUFRole.targets) + 1;
    const newSnapshotVersion = await getLatestMetadataVersion(teamID, TUFRepo.image, TUFRole.snapshot) + 1;
    const newTimestampVersion = await getLatestMetadataVersion(teamID, TUFRepo.image, TUFRole.timestamp) + 1;

    // read in keys from key storage
    const targetsKeyPair = await loadKeyPair(teamID, TUFRepo.image, TUFRole.targets);
    const snapshotKeyPair = await loadKeyPair(teamID, TUFRepo.image, TUFRole.snapshot);
    const timestampKeyPair = await loadKeyPair(teamID, TUFRepo.image, TUFRole.timestamp);

    // assemble information about this image to be put in the targets.json metadata
    // we grab the previous targets portion of the targets metadata and append this new image to it
    const latestTargets = await getLatestMetadata(teamID, TUFRepo.image, TUFRole.targets);

    // const targetsImages: ITargetsImages = latestTargets ? latestTargets.signed.targets : {};
    const targetsImages = latestTargets.signed.targets;

    // NOTE: image.type is lowercase in db, but aktualizr expects uppercase
    targetsImages[imageId] = {
        custom: {
            hardwareIds: hwids,
            targetFormat: String(imageContent.type).toUpperCase(),
            uri: `${config.ROBOT_GATEWAY_ORIGIN}/api/v0/robot/repo/images/${imageId}`
        },
        length: size,
        hashes: {
            sha256,
            // sha512
        }
    };

    // generate new set of tuf metadata (apart from root)
    const targetsMetadata = generateSignedTargets(config.TUF_TTL.IMAGE.TARGETS, newTargetsVersion, targetsKeyPair, targetsImages);
    const snapshotMetadata = generateSignedSnapshot(config.TUF_TTL.IMAGE.SNAPSHOT, newSnapshotVersion, snapshotKeyPair, targetsMetadata);
    const timestampMetadata = generateSignedTimestamp(config.TUF_TTL.IMAGE.TIMESTAMP, newTimestampVersion, timestampKeyPair, snapshotMetadata);

    // perform db writes in transaction
    try {
        const image = await prisma.$transaction(async tx => {

            // create tuf metadata
            // prisma wants to be passed an `object` instead of our custom interface so we cast it
            await tx.metadata.create({
                data: {
                    team_id: teamID,
                    repo: TUFRepo.image,
                    role: TUFRole.targets,
                    version: newTargetsVersion,
                    value: targetsMetadata as object,
                    expires_at: targetsMetadata.signed.expires
                }
            });

            await tx.metadata.create({
                data: {
                    team_id: teamID,
                    repo: TUFRepo.image,
                    role: TUFRole.snapshot,
                    version: newSnapshotVersion,
                    value: snapshotMetadata as object,
                    expires_at: snapshotMetadata.signed.expires
                }
            });

            await tx.metadata.create({
                data: {
                    team_id: teamID,
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
                    name: 'placeholder',
                    team_id: teamID,
                    size,
                    hwids,
                    sha256,
                    status: UploadStatus.uploading,
                    format
                }
            });

            // upload image to blob storage
            await blobStorage.putObject(teamID, `images/${imageId}`, imageContent);

            // update reference to image in db saying that it has completed uploading
            const image = await tx.image.update({
                where: {
                    team_id_id: {
                        team_id: teamID,
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
}




/**
 * List images in a team.
 */
export const listImages = async (req: Request, res: Response, next: NextFunction) => {

    const teamID = req.headers['air-team-id'];

    // get images
    const images = await prisma.image.findMany({
        where: {
            team_id: teamID
        },
        orderBy: {
            created_at: 'desc'
        }
    });

    const imagesSanitised = images.map(image => ({
        id: image.id,
        size: image.size,
        sha256: image.sha256,
        hwids: image.hwids,
        status: image.status,
        format: image.format,
        created_at: image.created_at,
        updated_at: image.updated_at
    }));

    logger.info('A user read a list of images');
    return new SuccessJsonResponse(res, imagesSanitised);
    
}
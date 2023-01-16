import prisma from '@airbotics-core/drivers/postgres';
import { keyStorage } from '@airbotics-core/key-storage';
import { generateHash } from '@airbotics-core/crypto/hashes';
import { UploadStatus, TUFRole, TUFRepo, ImageFormat } from "@prisma/client";
import {
    generateSignedSnapshot, generateSignedTargets, generateSignedTimestamp,
    getLatestMetadata, getLatestMetadataVersion
} from '@airbotics-core/tuf';
import { IKeyPair, ITargetsImages, ISignedTargetsTUF } from '@airbotics-types';
import { generateSlug } from 'random-word-slugs';
import {
    SEED_EXPIRES_AT, SEED_TEAM_ID,
    SEED_PRIMARY_ECU_ID, SEED_SECONDARY_ECU_ID
} from '../consts';
import { EHashDigest } from '@airbotics-core/consts';



/**
 * 
 * PREREQUISITES: This seeder requires the dev seeder to have run before.
 * Please run the dev up seeder before you run this. Which in turn
 * has prerequisites of its own.
 * 
 * This seeder creates the following records
 * 
 * 1. Two new test images (one for primary and secondary ecus) 
 * 2. TUF Metadata for the 3 top level roles in the image repo with accurate
 *    references to the newly created images 
 * 3. Two tmp rollouts, mapping the two test images to the two test ECUs
 * 
 */

//Generate a random but somewhat readable id for each new "image"
const primaryImageID = generateSlug();
const secondaryImageID = generateSlug();

//Generate a random payload for each new "image". Remember "images" for testing
//are simply strings
const primaryImageBody = generateSlug();
const secondaryImageBody = generateSlug();


const createImages = async () => {

    console.log('creating image...');

    await prisma.image.createMany({
        data: [
            {
                id: primaryImageID,
                name: 'name 1',
                team_id: SEED_TEAM_ID,
                size: Buffer.byteLength(primaryImageBody, "utf-8"),
                sha256: generateHash(primaryImageBody, { hashDigest: EHashDigest.Sha256 }),
                // sha512: generateHash(primaryImageBody, { algorithm: 'SHA512' }),
                status: UploadStatus.uploaded,
                format: ImageFormat.binary
            },
            {
                id: secondaryImageID,
                name: 'name 2',
                team_id: SEED_TEAM_ID,
                size: Buffer.byteLength(secondaryImageBody, "utf-8"),
                sha256: generateHash(secondaryImageBody, { hashDigest: EHashDigest.Sha256 }),
                // sha512: generateHash(secondaryImageBody, { algorithm: 'SHA512' }),
                status: UploadStatus.uploaded,
                format: ImageFormat.binary
            }
        ]
    });

    console.log('created image');

}


const createImageRepoMetadata = async () => {
    

    const targetKeyPair = await keyStorage.getKeyPair(`${SEED_TEAM_ID}-image-targets-public`);
    const snapshotKeyPair = await keyStorage.getKeyPair(`${SEED_TEAM_ID}-image-snapshot-public`);
    const timestampKeyPair = await keyStorage.getKeyPair(`${SEED_TEAM_ID}-image-timestamp-public`);


    // get new versions
    const newTargetsVersion = await getLatestMetadataVersion(SEED_TEAM_ID, TUFRepo.image, TUFRole.targets) + 1;
    const newSnapshotVersion = await getLatestMetadataVersion(SEED_TEAM_ID, TUFRepo.image, TUFRole.snapshot) + 1;
    const newTimestampVersion = await getLatestMetadataVersion(SEED_TEAM_ID, TUFRepo.image, TUFRole.timestamp) + 1;


    //To construct the new targets metadata, we need to grab the latest version so we can
    //append the new targets to the previous list.

    const latestTargets = await getLatestMetadata(SEED_TEAM_ID, TUFRepo.image, TUFRole.targets);
    const targetsImages: ITargetsImages = latestTargets ? latestTargets.signed.targets : {};


    //Append the two new images to the targetsImages
    targetsImages[primaryImageID] = {
        custom: {},
        length: Buffer.byteLength(primaryImageBody, "utf-8"),
        hashes: {
            sha256: generateHash(primaryImageBody, { hashDigest: EHashDigest.Sha256 }),
            // sha512: generateHash(primaryImageBody, { algorithm: 'SHA512' }),
        }
    };

    targetsImages[secondaryImageID] = {
        custom: {},
        length: Buffer.byteLength(secondaryImageBody, "utf-8"),
        hashes: {
            sha256: generateHash(secondaryImageBody, { hashDigest: EHashDigest.Sha256 }),
            // sha512: generateHash(secondaryImageBody, { algorithm: 'SHA512' }),
        }
    }


    //Generate the new targets metadata with the complete set of images 
    const targetsMetadata: ISignedTargetsTUF = generateSignedTargets(SEED_EXPIRES_AT, newTargetsVersion, targetKeyPair, targetsImages);
    const snapshotMetadata = generateSignedSnapshot(SEED_EXPIRES_AT, newSnapshotVersion, snapshotKeyPair, targetsMetadata);
    const timestampMetadata = generateSignedTimestamp(SEED_EXPIRES_AT, newTimestampVersion, timestampKeyPair, snapshotMetadata);

    //Store the metadata in the db
    await prisma.metadata.createMany({
        data: [
            {
                team_id: SEED_TEAM_ID,
                role: TUFRole.targets,
                repo: TUFRepo.image,
                version: newTargetsVersion,
                value: targetsMetadata as object,
                expires_at: targetsMetadata.signed.expires
            },
            {
                team_id: SEED_TEAM_ID,
                role: TUFRole.snapshot,
                repo: TUFRepo.image,
                version: newSnapshotVersion,
                value: snapshotMetadata as object,
                expires_at: snapshotMetadata.signed.expires
            },
            {
                team_id: SEED_TEAM_ID,
                role: TUFRole.timestamp,
                repo: TUFRepo.image,
                version: newTimestampVersion,
                value: timestampMetadata as object,
                expires_at: timestampMetadata.signed.expires
            }
        ]
    });

}


const createTmpRollout = async () => {

    console.log('creating tmp rollout...');

    await prisma.tmpEcuImages.createMany({
        data: [
            {
                ecu_id: SEED_PRIMARY_ECU_ID,
                image_id: primaryImageID
            },
            {
                ecu_id: SEED_SECONDARY_ECU_ID,
                image_id: secondaryImageID
            }
        ]
    })

    console.log('created tmp rollout');

}




(async () => {

    console.log('running img-rollouts seeder up...');

    await createImages();
    await createImageRepoMetadata();
    await createTmpRollout();

    console.log(`Primary ECU - Image ID: ${primaryImageID} Image Body: ${primaryImageBody}`);
    console.log(`Secondary ECU - Image ID: ${secondaryImageID} Image Body: ${secondaryImageBody}`);

    console.log('img-rollouts seeder up success');


})()
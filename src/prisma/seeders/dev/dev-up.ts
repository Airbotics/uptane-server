import fs from 'fs';
import path from 'path';
import config from '@airbotics-config';
import { prisma } from '@airbotics-core/drivers';
import { keyStorage } from '@airbotics-core/key-storage';
import { generateHash } from '@airbotics-core/crypto/hashes';
import { UploadStatus, TUFRole, TUFRepo, ImageFormat } from "@prisma/client";
import {
    generateSignedRoot, generateSignedSnapshot,
    generateSignedTargets, generateSignedTimestamp
} from '@airbotics-core/tuf';
import {
    IKeyPair, ISignedRootTUF, ITargetsImages,
    ISignedTargetsTUF, ISignedSnapshotTUF, ITimestampTUF
} from '@airbotics-types';
import {
    SEED_EXPIRES_AT, SEED_TEAM_ID,
    SEED_PRIMARY_ECU_ID, SEED_PRIMARY_IMAGE_ID,
    SEED_ROBOT_ID, SEED_SECONDARY_ECU_ID, SEED_SECONDARY_IMAGE_ID
} from '../consts';
import { EHashDigest } from '@airbotics-core/consts';


/**
 * 
 * PREREQUISITES: This seeder requires some key pairs to be generated before.
 * Please run the gen-keys script in the utils dir to ensure this seeder runs 
 * correctly
 * 
 * 
 * NOTE: This seeder is designed to be one in conjunction with dev-down.ts
 * 
 * if you attempt to run this twice in a row before running dev-down.ts
 * you will see db constraint errors
 * 
 * Also the key pairs that this seeder use from res/test-keys are TEST KEYS
 * and they SHOULD NEVER EVER BE USED OUTSIDE OF A TESTING ENVIRONMENT 
 * 
 * If you want to start from fresh simply run dev-down.ts first
 * 
 * This seeder creates the following records
 * 
 * 1. One test TEAM
 * 2. Two test images (one for primary and secondary ecus) 
 * 3. One test robot 
 * 4. Two test ECUs (primary and secondary) for the test robot
 * 5. A full set of TUF Metadata for the 4 top level roles in the image repo
 * 6. Two tmp rollouts, mapping the two test images to the two test ECUs
 * 
 */


const createTeam = async () => {

    console.log('dev seeder creating team...');

    await prisma.team.create({
        data: {
            id: SEED_TEAM_ID,
            name: SEED_TEAM_ID
        }
    });

    console.log('dev seeder created team');

}


const createImage = async () => {

    console.log('dev seeder creating image...');

    //The primary 'image' is simply a text file with 'primary' as the body
    //The secondary 'image' is simply a text file with 'secondary' as the body
    const primaryImage = 'primary';
    const secondaryImage = 'secondary';


    await prisma.image.createMany({
        data: [
            {
                id: SEED_PRIMARY_IMAGE_ID,
                name: 'image 1',
                team_id: SEED_TEAM_ID,
                hwids: [],
                size: Buffer.byteLength(primaryImage, "utf-8"),
                sha256: generateHash(primaryImage, { hashDigest: EHashDigest.Sha256 }),
                // sha512: generateHash(primaryImage, {algorithm: 'SHA512'}),
                status: UploadStatus.uploaded,
                format: ImageFormat.binary
            },
            {
                id: SEED_SECONDARY_IMAGE_ID,
                name: 'image 1',
                team_id: SEED_TEAM_ID,
                hwids: [],
                size: Buffer.byteLength(secondaryImage, "utf-8"),
                sha256: generateHash(secondaryImage, { hashDigest: EHashDigest.Sha256 }),
                // sha512: generateHash(secondaryImage, {algorithm: 'SHA512'}),
                status: UploadStatus.uploaded,
                format: ImageFormat.binary
            }
        ]
    });

    console.log('dev seeder created image');

}



const createRobot = async () => {

    console.log('dev seeder creating robot...');

    await prisma.robot.create({
        data: {
            id: SEED_ROBOT_ID,
            team_id: SEED_TEAM_ID
        }
    });

    console.log('dev seeder created robot');

}


const createECUs = async () => {

    console.log('dev seeder creating ECUs...');

    await prisma.ecu.createMany({
        data: [
            {
                id: SEED_PRIMARY_ECU_ID,
                team_id: SEED_TEAM_ID,
                robot_id: SEED_ROBOT_ID,
                hwid: 'some-hwid',
                primary: true
            },
            {
                id: SEED_SECONDARY_ECU_ID,
                team_id: SEED_TEAM_ID,
                robot_id: SEED_ROBOT_ID,
                hwid: 'some-hwid',
                primary: false
            }
        ]
    });

    console.log('dev seeder created ECUs');

}


const createImageRepoMetadata = async () => {

    console.log('dev seeder creating image repo metadata...');

    const rootKeyPair = await keyStorage.getKeyPair(`${SEED_TEAM_ID}-image-root-public`);
    const targetKeyPair = await keyStorage.getKeyPair(`${SEED_TEAM_ID}-image-targets-public`);
    const snapshotKeyPair = await keyStorage.getKeyPair(`${SEED_TEAM_ID}-image-snapshot-public`);
    const timestampKeyPair = await keyStorage.getKeyPair(`${SEED_TEAM_ID}-image-timestamp-public`);

    // generate root metadata
    const rootMetadata: ISignedRootTUF = generateSignedRoot(SEED_EXPIRES_AT,
        1,
        rootKeyPair,
        targetKeyPair,
        snapshotKeyPair,
        timestampKeyPair
    );

    //Generate target images
    const targetsImages: ITargetsImages = {
        [SEED_PRIMARY_IMAGE_ID]: {
            custom: {},
            length: 5,
            hashes: {
                sha256: '986a1b7135f4986150aa5fa0028feeaa66cdaf3ed6a00a355dd86e042f7fb494',
                // sha512: 'fa01128f36bcb2fd0ab277bced17de734c0e4a1e022dc26ad9b85d3b64a5c7af499d3af526fa25500bd73f4b2a0886b22a1e1ff68250de496aa4d847ffe9607b'
            }
        },
        [SEED_SECONDARY_IMAGE_ID]: {
            custom: {},
            length: 5,
            hashes: {
                sha256: 'c0f69e19ba252767f183158737ab1bc44f42380d2473ece23a4f276ae7c80dff',
                // sha512: '7ec0750d1e26845a313bf932749748516a1ce5d65f66fb50aa051047e3a91172c1e998a756f3981e38061f1a46d02d0e9162049e3bba1cdda176c42b145370b6'
            }
        }
    };

    // generate other top level metadata
    const targetsMetadata: ISignedTargetsTUF = generateSignedTargets(SEED_EXPIRES_AT, 1, targetKeyPair, targetsImages);
    const snapshotMetadata: ISignedSnapshotTUF = generateSignedSnapshot(SEED_EXPIRES_AT, 1, snapshotKeyPair, targetsMetadata);
    const timestampMetadata: ITimestampTUF = generateSignedTimestamp(SEED_EXPIRES_AT, 1, timestampKeyPair, snapshotMetadata);

    //Store the metadata in the db
    await prisma.tufMetadata.createMany({
        data: [
            {
                team_id: SEED_TEAM_ID,
                role: TUFRole.root,
                repo: TUFRepo.image,
                version: 1,
                value: rootMetadata as object,
                expires_at: rootMetadata.signed.expires
            },
            {
                team_id: SEED_TEAM_ID,
                role: TUFRole.targets,
                repo: TUFRepo.image,
                version: 1,
                value: targetsMetadata as object,
                expires_at: targetsMetadata.signed.expires
            },
            {
                team_id: SEED_TEAM_ID,
                role: TUFRole.snapshot,
                repo: TUFRepo.image,
                version: 1,
                value: snapshotMetadata as object,
                expires_at: snapshotMetadata.signed.expires
            },
            {
                team_id: SEED_TEAM_ID,
                role: TUFRole.timestamp,
                repo: TUFRepo.image,
                version: 1,
                value: timestampMetadata as object,
                expires_at: timestampMetadata.signed.expires
            },

        ]
    });

    console.log('dev seeder created image repo metadata');

}


const createDirectorRepoRootMetadata = async () => {

    console.log('dev seeder creating director repo root metadata...');

    const rootKeyPair = await keyStorage.getKeyPair(`${SEED_TEAM_ID}-director-root-public`);
    const targetKeyPair = await keyStorage.getKeyPair(`${SEED_TEAM_ID}-director-targets-public`);
    const snapshotKeyPair = await keyStorage.getKeyPair(`${SEED_TEAM_ID}-director-snapshot-public`);
    const timestampKeyPair = await keyStorage.getKeyPair(`${SEED_TEAM_ID}-director-timestamp-public`);

    const rootMetadata: ISignedRootTUF = generateSignedRoot(SEED_EXPIRES_AT,
        1,
        rootKeyPair,
        targetKeyPair,
        snapshotKeyPair,
        timestampKeyPair
    );

    //Store the metadata in the db
    await prisma.tufMetadata.create({
        data: {
            team_id: SEED_TEAM_ID,
            role: TUFRole.root,
            repo: TUFRepo.director,
            version: 1,
            value: rootMetadata as object,
            expires_at: rootMetadata.signed.expires
        }
    });

    console.log('dev seeder created director repo root metadata');

}


const createTmpRollout = async () => {

    console.log('dev seeder creating tmp rollout...');


    await prisma.tmpEcuImages.createMany({
        data: [
            {
                ecu_id: SEED_PRIMARY_ECU_ID,
                image_id: SEED_PRIMARY_IMAGE_ID
            },
            {
                ecu_id: SEED_SECONDARY_ECU_ID,
                image_id: SEED_SECONDARY_IMAGE_ID
            }
        ]
    })

    console.log('dev seeder created tmp rollout');

}


(async () => {

    console.log('running dev seeder up...');

    //check if the keys have been generated
    //This should probably check for all keys but just checks image root for now
    const seedRootCertPath = path.join(__filename, '../../../../../', config.KEYS_FS_STORAGE_DIR, `${SEED_TEAM_ID}-image-root-public.pem`)

    if (!fs.existsSync(seedRootCertPath)) {
        console.log('This seeder requires certs to be generated first');
        console.log('Try running: \nnpx ts-node src/seeders/utils/gen-keys.ts\n');
        return;
    }

    await createTeam();
    await createImage();
    await createRobot();
    await createECUs();
    await createImageRepoMetadata();
    await createDirectorRepoRootMetadata();
    await createTmpRollout();

    console.log('dev seeder up success');


})()
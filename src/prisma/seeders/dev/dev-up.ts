import prisma from '../../../core/postgres';
import fs from 'fs';
import { keyStorage } from '../../../core/key-storage';
import { generateRoot, generateSnapshot, generateTargets, generateTimestamp } from '../../../core/tuf';
import {
    UploadStatus,
    TUFRole,
    TUFRepo
} from "@prisma/client";
import { IKeyPair, IRootTUF, ITargetsImages, ITargetsTUF } from '../../../types';
import { ISnapshotTUF, ITimestampTUF } from '../../../types/index';
import path from 'path';
import config from '../../../config';


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
 * 1. One test namespace
 * 2. Two test images (one for primary and secondary ecus) 
 * 3. One test robot 
 * 4. Two test ECUs (primary and secondary) for the test robot
 * 5. A full set of TUF Metadata for the 4 top level roles in the image repo
 * 6. Two tmp rollouts, mapping the two test images to the two test ECUs
 * 
 */

const SEED_NAMESPACE_ID = 'seed';
const SEED_ROBOT_ID = 'seed-robot';
const SEED_PRIMARY_IMAGE_ID = 'seed-primary-image';
const SEED_SECONDARY_IMAGE_ID = 'seed-secondary-image';
const SEED_PRIMARY_ECU_ID = 'seed-primary-ecu';
const SEED_SECONDARY_ECU_ID = 'seed-secondary-ecu';
const SEED_EXPIRES_AT = [10, 'year']; //lets not worry about expiry for seeder



const createNamespace = async () => {

    console.log('dev seeder creating namespace...');

    await prisma.namespace.create({
        data: {
            id: SEED_NAMESPACE_ID
        }
    });

    console.log('dev seeder created namespace');

}


const createImage = async () => {

    console.log('dev seeder creating image...');

    //The primary 'image' is simply a text file with 'primary' as the body
    //The secondary 'image' is simply a text file with 'secondary' as the body
    await prisma.image.createMany({
        data: [
            {
                id: SEED_PRIMARY_IMAGE_ID,
                namespace_id: SEED_NAMESPACE_ID,
                size: 5,
                sha256: '986a1b7135f4986150aa5fa0028feeaa66cdaf3ed6a00a355dd86e042f7fb494',
                sha512: 'fa01128f36bcb2fd0ab277bced17de734c0e4a1e022dc26ad9b85d3b64a5c7af499d3af526fa25500bd73f4b2a0886b22a1e1ff68250de496aa4d847ffe9607b',
                status: UploadStatus.uploaded
            },
            {
                id: SEED_SECONDARY_IMAGE_ID,
                namespace_id: SEED_NAMESPACE_ID,
                size: 5,
                sha256: 'c0f69e19ba252767f183158737ab1bc44f42380d2473ece23a4f276ae7c80dff',
                sha512: '7ec0750d1e26845a313bf932749748516a1ce5d65f66fb50aa051047e3a91172c1e998a756f3981e38061f1a46d02d0e9162049e3bba1cdda176c42b145370b6',
                status: UploadStatus.uploaded
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
            namespace_id: SEED_NAMESPACE_ID
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
                namespace_id: SEED_NAMESPACE_ID,
                robot_id: SEED_ROBOT_ID,
                provisioned: true,
                primary: true
            },
            {
                id: SEED_SECONDARY_ECU_ID,
                namespace_id: SEED_NAMESPACE_ID,
                robot_id: SEED_ROBOT_ID,
                provisioned: true,
                primary: false
            }
        ]
    });

    console.log('dev seeder created ECUs');

}


const createImageRepoMetadata = async () => {

    console.log('dev seeder creating image repo metadata...');

    const rootKeyPair: IKeyPair = {
        publicKey: await keyStorage.getKey(`${SEED_NAMESPACE_ID}-image-root-public`),
        privateKey: await keyStorage.getKey(`${SEED_NAMESPACE_ID}-image-root-private`),
    }

    const targetKeyPair: IKeyPair = {
        publicKey: await keyStorage.getKey(`${SEED_NAMESPACE_ID}-image-targets-public`),
        privateKey: await keyStorage.getKey(`${SEED_NAMESPACE_ID}-image-targets-private`),
    }

    const snapshotKeyPair: IKeyPair = {
        publicKey: await keyStorage.getKey(`${SEED_NAMESPACE_ID}-image-snapshot-public`),
        privateKey: await keyStorage.getKey(`${SEED_NAMESPACE_ID}-image-snapshot-private`),
    }

    const timestampKeyPair: IKeyPair = {
        publicKey: await keyStorage.getKey(`${SEED_NAMESPACE_ID}-image-timestamp-public`),
        privateKey: await keyStorage.getKey(`${SEED_NAMESPACE_ID}-image-timestamp-private`),
    }

    // generate root metadata
    const rootMetadata: IRootTUF = generateRoot(SEED_EXPIRES_AT,
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
                sha512: 'fa01128f36bcb2fd0ab277bced17de734c0e4a1e022dc26ad9b85d3b64a5c7af499d3af526fa25500bd73f4b2a0886b22a1e1ff68250de496aa4d847ffe9607b'
            }
        },
        [SEED_SECONDARY_IMAGE_ID]: {
            custom: {},
            length: 5,
            hashes: {
                sha256: 'c0f69e19ba252767f183158737ab1bc44f42380d2473ece23a4f276ae7c80dff',
                sha512: '7ec0750d1e26845a313bf932749748516a1ce5d65f66fb50aa051047e3a91172c1e998a756f3981e38061f1a46d02d0e9162049e3bba1cdda176c42b145370b6'
            }
        }
    };

    // generate other top level metadata
    const targetsMetadata: ITargetsTUF = generateTargets(SEED_EXPIRES_AT, 1, targetKeyPair, targetsImages);
    const snapshotMetadata: ISnapshotTUF = generateSnapshot(SEED_EXPIRES_AT, 1, snapshotKeyPair, 1);
    const timestampMetadata: ITimestampTUF = generateTimestamp(SEED_EXPIRES_AT, 1, timestampKeyPair, 1);
    
    //Store the metadata in the db
    await prisma.metadata.createMany({
        data: [
            {
                namespace_id: SEED_NAMESPACE_ID,
                role: TUFRole.root,
                repo: TUFRepo.image,
                version: 1,
                value: rootMetadata as object,
                expires_at: rootMetadata.signed.expires
            },
            {
                namespace_id: SEED_NAMESPACE_ID,
                role: TUFRole.targets,
                repo: TUFRepo.image,
                version: 1,
                value: targetsMetadata as object,
                expires_at: targetsMetadata.signed.expires
            },
            {
                namespace_id: SEED_NAMESPACE_ID,
                role: TUFRole.snapshot,
                repo: TUFRepo.image,
                version: 1,
                value: snapshotMetadata as object,
                expires_at: snapshotMetadata.signed.expires
            },
            {
                namespace_id: SEED_NAMESPACE_ID,
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

    const rootKeyPair: IKeyPair = {
        publicKey: await keyStorage.getKey(`${SEED_NAMESPACE_ID}-director-root-public.pem`),
        privateKey: await keyStorage.getKey(`${SEED_NAMESPACE_ID}-director-root-private.pem`),
    }

    const targetKeyPair: IKeyPair = {
        publicKey: await keyStorage.getKey(`${SEED_NAMESPACE_ID}-director-targets-public.pem`),
        privateKey: await keyStorage.getKey(`${SEED_NAMESPACE_ID}-director-targets-private.pem`),
    }

    const snapshotKeyPair: IKeyPair = {
        publicKey: await keyStorage.getKey(`${SEED_NAMESPACE_ID}-director-snapshot-public.pem`),
        privateKey: await keyStorage.getKey(`${SEED_NAMESPACE_ID}-director-snapshot-private.pem`),
    }

    const timestampKeyPair: IKeyPair = {
        publicKey: await keyStorage.getKey(`${SEED_NAMESPACE_ID}-director-timestamp-public.pem`),
        privateKey: await keyStorage.getKey(`${SEED_NAMESPACE_ID}-director-timestamp-private.pem`),
    }

    const rootMetadata: IRootTUF = generateRoot(SEED_EXPIRES_AT,
        1,
        rootKeyPair,
        targetKeyPair,
        snapshotKeyPair,
        timestampKeyPair
    );

    //Store the metadata in the db
    await prisma.metadata.create({
        data: {
            namespace_id: SEED_NAMESPACE_ID,
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

    //check if the keys have been generated
    //This should probably check for all keys but just checks image root for now
    const seedRootCertPath = path.join(__filename, '../../../../../',  config.KEYS_FS_STORAGE_DIR, `${SEED_NAMESPACE_ID}-image-root-public`)

    if(!fs.existsSync(seedRootCertPath)) {
        console.log('This seeder requires certs to be generated first');
        console.log('Try running: \nnpx ts-node src/seeders/utils/gen-keys.ts\n');
        return;
    }

    await createNamespace();
    await createImage();
    await createRobot();
    await createECUs();
    await createImageRepoMetadata();
    await createDirectorRepoRootMetadata();
    await createTmpRollout();

})()



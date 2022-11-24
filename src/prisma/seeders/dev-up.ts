import prisma from '../../core/postgres';
import config from '../../config';
import path from 'path';
import { keyStorage } from '../../core/key-storage';
import { generateRoot, generateSnapshot, generateTargets, generateTimestamp } from '../../core/tuf';
import {
    Namespace,
    Ecu,
    UploadStatus,
    TUFRole,
    TUFRepo
} from "@prisma/client";
import { IKeyPair, IRootTUF, ITargetsImages, ITargetsTUF } from '../../types';
import { ISnapshotTUF, ITimestampTUF } from '../../types/index';


/**
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

const NAMESPACE_ID = 'test-namespace';
const ROBOT_ID = 'test-robot';
const PRIMARY_IMAGE_ID = 'test-primary-image';
const SECONDARY_IMAGE_ID = 'test-secondary-image';
const PRIMARY_ECU_ID = 'test-primary-ecu';
const SECONDARY_ECU_ID = 'test-secondary-ecu';
const EXPIRES_AT = [10, 'year']; //lets not worry about expiry for seeder



const createNamespace = async () => {

    console.log('dev seeder creating namespace...');

    await prisma.namespace.create({
        data: {
            id: NAMESPACE_ID
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
                id: PRIMARY_IMAGE_ID,
                namespace_id: NAMESPACE_ID,
                size: 5,
                sha256: '986a1b7135f4986150aa5fa0028feeaa66cdaf3ed6a00a355dd86e042f7fb494',
                sha512: 'fa01128f36bcb2fd0ab277bced17de734c0e4a1e022dc26ad9b85d3b64a5c7af499d3af526fa25500bd73f4b2a0886b22a1e1ff68250de496aa4d847ffe9607b',
                status: UploadStatus.uploaded
            },
            {
                id: SECONDARY_IMAGE_ID,
                namespace_id: NAMESPACE_ID,
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
            id: ROBOT_ID,
            namespace_id: NAMESPACE_ID
        }
    });

    console.log('dev seeder created robot');

}


const createECUs = async () => {

    console.log('dev seeder creating ECUs...');

    await prisma.ecu.createMany({
        data: [
            {
                id: PRIMARY_ECU_ID,
                namespace_id: NAMESPACE_ID,
                robot_id: ROBOT_ID,
                provisioned: true,
                primary: true
            },
            {
                id: SECONDARY_ECU_ID,
                namespace_id: NAMESPACE_ID,
                robot_id: ROBOT_ID,
                provisioned: true,
                primary: false
            }
        ]
    });

    console.log('dev seeder created ECUs');

}


const createImageRepoMetadata = async () => {

    console.log('dev seeder creating image repo metadata...');

    //Update this to read keys from res test folder
    config.KEYS_FS_STORAGE_DIR = path.resolve(path.join(__filename, '..', '..', '..', '..', 'res', 'test-keys'));

    const rootKeyPair: IKeyPair = {
        publicKey: await keyStorage.getKey('test-image-root-public'),
        privateKey: await keyStorage.getKey('test-image-root-private')
    }

    const targetKeyPair: IKeyPair = {
        publicKey: await keyStorage.getKey('test-image-targets-public'),
        privateKey: await keyStorage.getKey('test-image-targets-private')
    }

    const snapshotKeyPair: IKeyPair = {
        publicKey: await keyStorage.getKey('test-image-snapshot-public'),
        privateKey: await keyStorage.getKey('test-image-snapshot-private')
    }

    const timestampKeyPair: IKeyPair = {
        publicKey: await keyStorage.getKey('test-image-timestamp-public'),
        privateKey: await keyStorage.getKey('test-image-timestamp-private')
    }

    // generate root metadata
    const rootMetadata: IRootTUF = generateRoot(EXPIRES_AT,
        1,
        rootKeyPair,
        targetKeyPair,
        snapshotKeyPair,
        timestampKeyPair
    );
    
    //Generate target images
    const targetsImages: ITargetsImages = {
        [PRIMARY_IMAGE_ID]: {
            custom: {},
            length: 5,
            hashes: {
                sha256: '986a1b7135f4986150aa5fa0028feeaa66cdaf3ed6a00a355dd86e042f7fb494',
                sha512: 'fa01128f36bcb2fd0ab277bced17de734c0e4a1e022dc26ad9b85d3b64a5c7af499d3af526fa25500bd73f4b2a0886b22a1e1ff68250de496aa4d847ffe9607b'
            }
        },
        [SECONDARY_IMAGE_ID]: {
            custom: {},
            length: 5,
            hashes: {
                sha256: 'c0f69e19ba252767f183158737ab1bc44f42380d2473ece23a4f276ae7c80dff',
                sha512: '7ec0750d1e26845a313bf932749748516a1ce5d65f66fb50aa051047e3a91172c1e998a756f3981e38061f1a46d02d0e9162049e3bba1cdda176c42b145370b6'
            }
        }
    };

    // generate other top level metadata
    const targetsMetadata: ITargetsTUF = generateTargets(EXPIRES_AT, 1, targetKeyPair, targetsImages);
    const snapshotMetadata: ISnapshotTUF = generateSnapshot(EXPIRES_AT, 1, snapshotKeyPair, 1);
    const timestampMetadata: ITimestampTUF = generateTimestamp(EXPIRES_AT, 1, timestampKeyPair, 1);
    
    //Store the metadata in the db
    await prisma.metadata.createMany({
        data: [
            {
                namespace_id: NAMESPACE_ID,
                role: TUFRole.root,
                repo: TUFRepo.image,
                version: 1,
                value: rootMetadata as object,
                expires_at: rootMetadata.signed.expires
            },
            {
                namespace_id: NAMESPACE_ID,
                role: TUFRole.targets,
                repo: TUFRepo.image,
                version: 1,
                value: targetsMetadata as object,
                expires_at: targetsMetadata.signed.expires
            },
            {
                namespace_id: NAMESPACE_ID,
                role: TUFRole.snapshot,
                repo: TUFRepo.image,
                version: 1,
                value: snapshotMetadata as object,
                expires_at: snapshotMetadata.signed.expires
            },
            {
                namespace_id: NAMESPACE_ID,
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


const createTmpRollout = async () => {

    console.log('dev seeder creating tmp rollout...');


    await prisma.tmpEcuImages.createMany({
        data: [
            {
                ecu_id: PRIMARY_ECU_ID,
                image_id: PRIMARY_IMAGE_ID
            },
            {
                ecu_id: SECONDARY_ECU_ID,
                image_id: SECONDARY_IMAGE_ID
            }
        ]
    })

    console.log('dev seeder created tmp rollout');

}


(async () => {

    await createNamespace();
    await createImage();
    await createRobot();
    await createECUs();
    await createImageRepoMetadata();
    await createTmpRollout();

})()



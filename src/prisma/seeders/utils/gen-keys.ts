import { generateKeyPair } from '../../../core/crypto';
import { keyStorage } from '../../../core/key-storage';
import config from '../../../config';


const SEED_TEAM_ID = 'seed';
const SEED_PRIMARY_ECU_ID = 'seed-primary-ecu';
const SEED_SECONDARY_ECU_ID = 'seed-secondary-ecu';


(async () => {

    console.log('Generating keys for seeder...');
    
    //Image repo keys
    const imageRootKey = generateKeyPair({keyType: config.TUF_KEY_TYPE});
    const imageTargetsKey = generateKeyPair({keyType: config.TUF_KEY_TYPE});
    const imageSnapshotKey = generateKeyPair({keyType: config.TUF_KEY_TYPE});
    const imageTimestampKey = generateKeyPair({keyType: config.TUF_KEY_TYPE});

    await keyStorage.putKeyPair(`${SEED_TEAM_ID}-image-root`, {
        publicKey: imageRootKey.publicKey,
        privateKey: imageRootKey.privateKey
    });
    await keyStorage.putKeyPair(`${SEED_TEAM_ID}-image-targets`, {
        publicKey: imageTargetsKey.publicKey,
        privateKey: imageTargetsKey.privateKey
    });
    await keyStorage.putKeyPair(`${SEED_TEAM_ID}-image-snapshot`, {
        publicKey: imageSnapshotKey.publicKey,
        privateKey: imageSnapshotKey.privateKey
    });
    await keyStorage.putKeyPair(`${SEED_TEAM_ID}-image-timestamp`, {
        publicKey: imageTimestampKey.publicKey,
        privateKey: imageTimestampKey.privateKey
    });



    //Director repo keys
    const directorRootKey = generateKeyPair({keyType: config.TUF_KEY_TYPE});
    const directorTargetsKey = generateKeyPair({keyType: config.TUF_KEY_TYPE});
    const directorSnapshotKey = generateKeyPair({keyType: config.TUF_KEY_TYPE});
    const directorTimestampKey = generateKeyPair({keyType: config.TUF_KEY_TYPE});

    await keyStorage.putKeyPair(`${SEED_TEAM_ID}-director-root`, {
        publicKey: directorRootKey.publicKey,
        privateKey: directorRootKey.privateKey
    });
    await keyStorage.putKeyPair(`${SEED_TEAM_ID}-director-targets`, {
        publicKey: directorTargetsKey.publicKey,
        privateKey: directorTargetsKey.privateKey
    });
    await keyStorage.putKeyPair(`${SEED_TEAM_ID}-director-snapshot`, {
        publicKey: directorSnapshotKey.publicKey,
        privateKey: directorSnapshotKey.privateKey
    });
    await keyStorage.putKeyPair(`${SEED_TEAM_ID}-director-timestamp`, {
        publicKey: directorTimestampKey.publicKey,
        privateKey: directorTimestampKey.privateKey
    });
    
    //ECU keys
    const primaryEcuKey = generateKeyPair({keyType: config.TUF_KEY_TYPE});
    const secondaryEcuKey = generateKeyPair({keyType: config.TUF_KEY_TYPE});
    
    await keyStorage.putKeyPair(`${SEED_TEAM_ID}-${SEED_PRIMARY_ECU_ID}`, {
        publicKey: primaryEcuKey.publicKey,
        privateKey: ''
    });

    await keyStorage.putKeyPair(`${SEED_TEAM_ID}-${SEED_SECONDARY_ECU_ID}`, {
        publicKey: secondaryEcuKey.publicKey,
        privateKey: ''
    });

    console.log('Generated keys for seeder');


})()



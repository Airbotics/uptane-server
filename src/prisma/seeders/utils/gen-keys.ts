import { generateKeyPair } from '../../../core/crypto';
import { keyStorage } from '../../../core/key-storage';
import config from '../../../config';


const SEED_TEAM_ID = 'seed';
const SEED_PRIMARY_ECU_ID = 'seed-primary-ecu';
const SEED_SECONDARY_ECU_ID = 'seed-secondary-ecu';


(async () => {

    console.log('Generating keys for seeder...');
    
    //Image repo keys
    const imageRootKey = generateKeyPair(config.KEY_TYPE);
    const imageTargetsKey = generateKeyPair(config.KEY_TYPE);
    const imageSnapshotKey = generateKeyPair(config.KEY_TYPE);
    const imageTimestampKey = generateKeyPair(config.KEY_TYPE);

    await keyStorage.putKey(`${SEED_TEAM_ID}-image-root-private`, imageRootKey.privateKey);
    await keyStorage.putKey(`${SEED_TEAM_ID}-image-targets-private`, imageTargetsKey.privateKey);
    await keyStorage.putKey(`${SEED_TEAM_ID}-image-snapshot-private`, imageSnapshotKey.privateKey);
    await keyStorage.putKey(`${SEED_TEAM_ID}-image-timestamp-private`, imageTimestampKey.privateKey);
    await keyStorage.putKey(`${SEED_TEAM_ID}-image-root-public`, imageRootKey.publicKey);
    await keyStorage.putKey(`${SEED_TEAM_ID}-image-targets-public`, imageTargetsKey.publicKey);
    await keyStorage.putKey(`${SEED_TEAM_ID}-image-snapshot-public`, imageSnapshotKey.publicKey);
    await keyStorage.putKey(`${SEED_TEAM_ID}-image-timestamp-public`, imageTimestampKey.publicKey);


    //Director repo keys
    const directorRootKey = generateKeyPair(config.KEY_TYPE);
    const directorTargetsKey = generateKeyPair(config.KEY_TYPE);
    const directorSnapshotKey = generateKeyPair(config.KEY_TYPE);
    const directorTimestampKey = generateKeyPair(config.KEY_TYPE);

    await keyStorage.putKey(`${SEED_TEAM_ID}-director-root-private`, directorRootKey.privateKey);
    await keyStorage.putKey(`${SEED_TEAM_ID}-director-targets-private`, directorTargetsKey.privateKey);
    await keyStorage.putKey(`${SEED_TEAM_ID}-director-snapshot-private`, directorSnapshotKey.privateKey);
    await keyStorage.putKey(`${SEED_TEAM_ID}-director-timestamp-private`, directorTimestampKey.privateKey);
    await keyStorage.putKey(`${SEED_TEAM_ID}-director-root-public`, directorRootKey.publicKey);
    await keyStorage.putKey(`${SEED_TEAM_ID}-director-targets-public`, directorTargetsKey.publicKey);
    await keyStorage.putKey(`${SEED_TEAM_ID}-director-snapshot-public`, directorSnapshotKey.publicKey);
    await keyStorage.putKey(`${SEED_TEAM_ID}-director-timestamp-public`, directorTimestampKey.publicKey);
    
    //ECU keys
    const primaryEcuKey = generateKeyPair(config.KEY_TYPE);
    const secondaryEcuKey = generateKeyPair(config.KEY_TYPE);

    await keyStorage.putKey(`${SEED_TEAM_ID}-${SEED_PRIMARY_ECU_ID}-private`, primaryEcuKey.privateKey);
    await keyStorage.putKey(`${SEED_TEAM_ID}-${SEED_PRIMARY_ECU_ID}-public`, primaryEcuKey.publicKey);
    await keyStorage.putKey(`${SEED_TEAM_ID}-${SEED_SECONDARY_ECU_ID}-private`, secondaryEcuKey.privateKey);
    await keyStorage.putKey(`${SEED_TEAM_ID}-${SEED_SECONDARY_ECU_ID}-public`, secondaryEcuKey.publicKey);

    console.log('Generated keys for seeder');


})()



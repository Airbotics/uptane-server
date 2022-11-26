import { generateKeyPair } from '../../../core/crypto';
import { keyStorage } from '../../../core/key-storage';
import config from '../../../config';


const SEED_NAMESPACE_ID = 'seed';
const SEED_PRIMARY_ECU_ID = 'seed-primary-ecu';
const SEED_SECONDARY_ECU_ID = 'seed-secondary-ecu';


(async () => {

    console.log('Generating keys for seeder...');
    
    //Image repo keys
    const imageRootKey = generateKeyPair(config.KEY_TYPE);
    const imageTargetsKey = generateKeyPair(config.KEY_TYPE);
    const imageSnapshotKey = generateKeyPair(config.KEY_TYPE);
    const imageTimestampKey = generateKeyPair(config.KEY_TYPE);

    await keyStorage.putKey(`${SEED_NAMESPACE_ID}-image-root-private.pem`, imageRootKey.privateKey);
    await keyStorage.putKey(`${SEED_NAMESPACE_ID}-image-targets-private.pem`, imageTargetsKey.privateKey);
    await keyStorage.putKey(`${SEED_NAMESPACE_ID}-image-snapshot-private.pem`, imageSnapshotKey.privateKey);
    await keyStorage.putKey(`${SEED_NAMESPACE_ID}-image-timestamp-private.pem`, imageTimestampKey.privateKey);
    await keyStorage.putKey(`${SEED_NAMESPACE_ID}-image-root-public.pem`, imageRootKey.publicKey);
    await keyStorage.putKey(`${SEED_NAMESPACE_ID}-image-targets-public.pem`, imageTargetsKey.publicKey);
    await keyStorage.putKey(`${SEED_NAMESPACE_ID}-image-snapshot-public.pem`, imageSnapshotKey.publicKey);
    await keyStorage.putKey(`${SEED_NAMESPACE_ID}-image-timestamp-public.pem`, imageTimestampKey.publicKey);


    //Director repo keys
    const directorRootKey = generateKeyPair(config.KEY_TYPE);
    const directorTargetsKey = generateKeyPair(config.KEY_TYPE);
    const directorSnapshotKey = generateKeyPair(config.KEY_TYPE);
    const directorTimestampKey = generateKeyPair(config.KEY_TYPE);

    await keyStorage.putKey(`${SEED_NAMESPACE_ID}-director-root-private.pem`, directorRootKey.privateKey);
    await keyStorage.putKey(`${SEED_NAMESPACE_ID}-director-targets-private.pem`, directorTargetsKey.privateKey);
    await keyStorage.putKey(`${SEED_NAMESPACE_ID}-director-snapshot-private.pem`, directorSnapshotKey.privateKey);
    await keyStorage.putKey(`${SEED_NAMESPACE_ID}-director-timestamp-private.pem`, directorTimestampKey.privateKey);
    await keyStorage.putKey(`${SEED_NAMESPACE_ID}-director-root-public.pem`, directorRootKey.publicKey);
    await keyStorage.putKey(`${SEED_NAMESPACE_ID}-director-targets-public.pem`, directorTargetsKey.publicKey);
    await keyStorage.putKey(`${SEED_NAMESPACE_ID}-director-snapshot-public.pem`, directorSnapshotKey.publicKey);
    await keyStorage.putKey(`${SEED_NAMESPACE_ID}-director-timestamp-public.pem`, directorTimestampKey.publicKey);
    
    //ECU keys
    const primaryEcuKey = generateKeyPair(config.KEY_TYPE);
    const secondaryEcuKey = generateKeyPair(config.KEY_TYPE);

    await keyStorage.putKey(`${SEED_NAMESPACE_ID}-${SEED_PRIMARY_ECU_ID}-private.pem`, primaryEcuKey.privateKey);
    await keyStorage.putKey(`${SEED_NAMESPACE_ID}-${SEED_PRIMARY_ECU_ID}-public.pem`, primaryEcuKey.publicKey);
    await keyStorage.putKey(`${SEED_NAMESPACE_ID}-${SEED_SECONDARY_ECU_ID}-private.pem`, secondaryEcuKey.privateKey);
    await keyStorage.putKey(`${SEED_NAMESPACE_ID}-${SEED_SECONDARY_ECU_ID}-public.pem`, secondaryEcuKey.publicKey);

    console.log('Generated keys for seeder');


})()



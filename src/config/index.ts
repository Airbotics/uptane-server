import dotenv from 'dotenv';
import { EBlobStorageProvider, EKeyStorageProvider, EKeyType, ESignatureScheme } from '@airbotics-core/consts';

dotenv.config();

const DEFAULT_CONN_STR = 'postgresql://user:password@localhost:5432/db?schema=public';


// NOTE: it would be nice to use something like TOML here, but we'll just keep it js for now
const config = {

    // postgres
    POSTGRES_CONN_STR: process.env.POSTGRES_CONN_STR || DEFAULT_CONN_STR,       // connection string for postgres

    // http server
    PORT: process.env.PORT || 8001,                                             // port the server listens on
    NODE_ENV: process.env.NODE_ENV || 'development',                            // mode to run the server in, 'production' or 'development'
    MAX_JSON_REQUEST_SIZE: '100mb',                                             // max json size we accept
    MAIN_SERVER_ORIGIN: 'http://localhost:8002',                                // origin of the main server
    ROBOT_GATEWAY_ORIGIN: 'https://localhost:8003',                             // origin of the robot gateway

    // blob storage
    BLOB_STORAGE_PROVIDER: EBlobStorageProvider.Fs,                             // blob storage provider to use
    BLOB_FS_STORAGE_DIR: './.blobs',                                            // where ostree blobs are stored when filesystem provider is being used

    // key storage and management
    KEY_STORAGE_PROVIDER: EKeyStorageProvider.Filesystem,                       // key storage provider to use
    KEYS_FS_STORAGE_DIR: './.keys',                                             // where private keys are stored when filesystem provider is being used

    // tuf
    TUF_KEY_TYPE: EKeyType.Rsa,                                                 // key type to use for TUF
    TUF_SIGNATURE_SCHEME: ESignatureScheme.RsassaPssSha256,                     // signature scheme to use for TUF (must correspond to key type above)
    TUF_CONSISTENT_SNAPSHOT: false,                                             // whether we use consistent snapshots (more of a const that config for now...)
    TUF_EXPIRY_WINDOW: [3, 'hour'],                                             // if a TUF metadata is due to expiry within this number of <units> it will be resigned
    TUF_TARGETS_FILE_SIZE_LIMIT: 10737418240,                                   // 10 gb in bytes
    TUF_TTL: {
        DIRECTOR: {
            ROOT: [365, 'day'],                                                 // expiry of director root metadata in days
            TARGETS: [1, 'day'],                                                // expiry of director targets metadata in days
            SNAPSHOT: [1, 'day'],                                               // expiry of director snapshot metadata in days
            TIMESTAMP: [1, 'day'],                                              // expiry of director timestamp metadata in days
        },
        IMAGE: {
            ROOT: [365, 'day'],                                                 // expiry of image root metadata in days
            TARGETS: [365, 'day'],                                              // expiry of image targets metadata in days
            SNAPSHOT: [1, 'day'],                                               // expiry of image snapshot metadata in days
            TIMESTAMP: [1, 'day'],                                              // expiry of image timestamp metadata in days
        }
    },

    // aws
    AWS_REGION: process.env.AWS_REGION,                                         // aws region to use
    AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,                           // aws access key id
    AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,                   // aws secret acess key
    AWS_S3_ENDPOINT: process.env.AWS_S3_ENDPOINT,                               // aws s3 endpoint to connect to
    AWS_SM_ENDPOINT: process.env.AWS_SM_ENDPOINT,                               // aws secrets manager endpoint to connect to

    // ory
    ORY_ACCESS_TOKEN: process.env.ORY_ACCESS_TOKEN,                             // Access token for ory
    ORY_PROJECT_URL: process.env.ORY_PROJECT_URL,                               // Project url for ory
    ORY_SCHEMA_ID: process.env.ORY_SCHEMA_ID,                                   // scehma ID for ory
    ORY_TIMEOUT: 4000,                                                          // timeout in ms

    // background worker
    WORKER_CRON: '0 * * * *',                                                   // cron to run background worker, i.e. every hour
    USE_NODE_SCHEDULER: true,                                                   // whether to use the nodejs scheduler to run workers, for development

    // manifest processing
    PRIMARY_ECU_VALID_FOR_SECS: process.env.SECONDARY_ECU_VALID_FOR_SECS || 3600,
    SECONDARY_ECU_VALID_FOR_SECS: process.env. SECONDARY_ECU_VALID_FOR_SECS || 43200,

    // logs
    LOGS_DIR: '.logs',                                                          // local log directory

    // root ca
    ROOT_CA_TTL: [10, 'year'],                                                  // expiry of the root ca cert


};

export default config;
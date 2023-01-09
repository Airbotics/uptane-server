import dotenv from 'dotenv';
import { EBlobStorageProvider, EKeyStorageProvider } from '@airbotics-core/consts';

dotenv.config();

const DEFAULT_CONN_STR = 'postgresql://user:password@localhost:5432/db?schema=public';

// available time units are here: https://day.js.org/docs/en/manipulate/add#list-of-all-available-units
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
    KEY_TYPE: 'rsa' as 'rsa',                                                   // the key type to use for all keys (more of a const that config for now...)

    // tuf
    TUF_SPEC_VERSION: '1.0.30',                                                 // TUF spec we're using (more of a const that config for now...)
    TUF_CONSISTENT_SNAPSHOT: true,                                              // whether we use consistent snapshots (more of a const that config for now...)
    TUF_EXPIRY_WINDOW: [3, 'hour'],                                             // if a TUF metadata is due to expiry within this number of <units> it will be resigned
    TUF_TIME_FORMAT: 'YYYY-MM-DDTHH:mm:ss[Z]',
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

    //ory
    ORY_ACCESS_TOKEN: process.env.ORY_ACCESS_TOKEN,                             // Access token for ory

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
    ROOT_CA_CN: 'airbotics-root',                                               // common name of the root ca


};

export default config;
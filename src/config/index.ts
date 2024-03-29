import dotenv from 'dotenv';
import {
    EBlobStorageProvider,
    ECertificateManagerProvider,
    EKeyStorageProvider,
    EKeyType,
    ESignatureScheme
} from '@airbotics-core/consts';

dotenv.config();

const DEFAULT_CONN_STR = 'postgresql://user:password@localhost:5432/db?schema=public';
const NODE_ENV = process.env.NODE_ENV || 'development';

const config = {

    // postgres
    POSTGRES_CONN_STR: process.env.POSTGRES_CONN_STR || DEFAULT_CONN_STR,       // connection string for postgres

    // http server
    PORT: Number(process.env.PORT) || 8001,                                             // port the server listens on
    NODE_ENV: NODE_ENV,                                                         // mode to run the server in, 'production' or 'development'
    MAX_JSON_REQUEST_SIZE: '100mb',                                             // max json size we accept
    MAX_TREEHUB_REQUEST_SIZE: '2048mb',                                          // max binary size we accept for treehub objects, refs and summaries
    API_ORIGIN: NODE_ENV === 'development' ? 'http://localhost:8002' : 'https://api.airbotics.io',
    GATEWAY_ORIGIN: NODE_ENV === 'development' ? 'https://localhost:8003': 'https://m2m.airbotics.io',
    CORS_ORIGIN: NODE_ENV==='production' ? ['https://dashboard.staging.airbotics.io', 'https://dashboard.airbotics.io'] : 'http://localhost:3000',

    // blob storage provider to use
    BLOB_STORAGE_PROVIDER: process.env.BLOB_STORAGE_PROVIDER as EBlobStorageProvider || EBlobStorageProvider.Filesystem,
    BLOB_FS_STORAGE_DIR: './.blobs',                                            // where ostree blobs are stored when filesystem provider is being used

    // key storage and management to use
    KEY_STORAGE_PROVIDER: process.env.KEY_STORAGE_PROVIDER as EKeyStorageProvider || EKeyStorageProvider.Filesystem,
    KEYS_FS_STORAGE_DIR: './.keys',                                             // where private keys are stored when filesystem provider is being used

    // certificate storage and management to use
    CERTIFICATE_MANAGER_PROVIDER: process.env.CERTIFICATE_MANAGER_PROVIDER as ECertificateManagerProvider || ECertificateManagerProvider.Local,

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
    AWS_LOCAL_ENDPOINT: process.env.AWS_LOCAL_ENDPOINT,                         // local aws endpoint
    AWS_ACM_PCA_ROOT_CA_ARN: process.env.AWS_ACM_PCA_ROOT_CA_ARN,               // arn of aws acm pca root ca
    TREEHUB_BUCKET_NAME: process.env.TREEHUB_BUCKET_NAME,                       // s3 bucket to use for treeub

    // ory
    ORY_ACCESS_TOKEN: process.env.ORY_ACCESS_TOKEN,                             // Access token for ory
    ORY_PROJECT_URL: process.env.ORY_PROJECT_URL,                               // Project url for ory
    ORY_SCHEMA_ID: process.env.ORY_SCHEMA_ID,                                   // scehma ID for ory
    ORY_TIMEOUT: 4000,                                                          // timeout in ms

    // background workers
    USE_NODE_SCHEDULER: process.env.USE_NODE_SCHEDULER || 'true',               // whether to use the nodejs scheduler to run workers, for development
    WORKERS: {
        ROLLOUTS_CRON: process.env.ROLLOUTS_CRON || '*/10 * * * * *',           // how often to run the rollouts worker
        TUF_RESIGNER_CRON: process.env.TUF_RESIGNER_CRON || '0 * * * *',        // how often to run the tuf resigner
        RESOURCE_PURGER: process.env.RESOURCE_PURGER || '0 * * * *',            // how often to run the resource purger
    },

    // manifest processing
    PRIMARY_ECU_VALID_FOR_SECS: process.env.SECONDARY_ECU_VALID_FOR_SECS || 3600,
    SECONDARY_ECU_VALID_FOR_SECS: process.env.SECONDARY_ECU_VALID_FOR_SECS || 43200,

    // logs
    LOGS_DIR: process.env.LOGS_DIR || '.logs',                                  // absolute path to local log directory

    // certs
    ROOT_CA_EXPIRY_MAX: 1830297600001,                                          // 2028 in unix time (milliseconds)
    ROBOT_CERT_TTL: [5, 'year'],                                               // expiry of robot certs
    DEV_ROOT_CA_TTL: [20, 'year'],                                              // expiry of dev root cert
    DEV_GATEWAY_CA_TTL: [10, 'year'],                                           // expiry of dev gateway cert

    BETA_INVITE_CODE: process.env.BETA_INVITE_CODE

};

export default config;
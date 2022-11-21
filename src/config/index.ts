import dotenv from 'dotenv';
import { EBlobStorageProvider, EKeyStorageProvider } from '../core/consts';

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

    // blob storage
    BLOB_STORAGE_PROVIDER: EBlobStorageProvider.S3,                             // blob storage provider to use
    BLOB_FS_STORAGE_DIR: './.blobs',                                            // where ostree blobs are stored when filesystem provider is being used

    // key storage and management
    KEY_STORAGE_PROVIDER: EKeyStorageProvider.Filesystem,                       // key storage provider to use
    KEYS_FS_STORAGE_DIR: './.keys',                                             // where private keys are stored when filesystem provider is being used
    KEY_TYPE: 'rsa' as 'rsa',                                                   // the key type to use for all keys (more of a const that config for now...)

    // tuf
    TUF_SPEC_VERSION: '1.0.30',                                                 // TUF spec we're using (more of a const that config for now...)
    TUF_CONSISTENT_SNAPSHOT: true,                                              // whether we use consistent snapshots (more of a const that config for now...)
    TUF_TTL: {
        DIRECTOR: {
            ROOT: 365,                                                          // expiry of director root metadata in days
            TARGETS: 1,                                                         // expiry of director targets metadata in days
            SNAPSHOT: 1,                                                        // expiry of director snapshot metadata in days
            TIMESTAMP: 1                                                        // expiry of director timestamp metadata in days
        },
        IMAGE: {
            ROOT: 365,                                                          // expiry of image root metadata in days
            TARGETS: 365,                                                       // expiry of image targets metadata in days
            SNAPSHOT: 1,                                                        // expiry of image snapshot metadata in days
            TIMESTAMP: 1                                                        // expiry of image timestamp metadata in days
        }
    },

    // aws
    AWS_REGION: process.env.AWS_REGION,                                         // aws region to use
    AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,                           // aws access key id
    AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,                   // aws secret acess key
    AWS_S3_ENDPOINT: process.env.AWS_S3_ENDPOINT,                               // aws s3 endpoint to connect to

    PRIMARY_ECU_VALID_FOR_SECS: process.env.SECONDARY_ECU_VALID_FOR_SECS || 3600,
    SECONDARY_ECU_VALID_FOR_SECS: process.env. SECONDARY_ECU_VALID_FOR_SECS || 43200,


};

export default config;
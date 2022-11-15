import dotenv from 'dotenv';
import { EBlobStorageProvider, EKeyStorageProvider } from '../core/consts';

dotenv.config();

const DEFAULT_CONN_STR = 'postgresql://user:password@localhost:5432/db?schema=public';

const config = {

    // postgres
    POSTGRES_CONN_STR: process.env.POSTGRES_CONN_STR || DEFAULT_CONN_STR,       // connection string for postgres

    // server
    PORT: process.env.PORT || 8001,                                             // port the server listens on
    NODE_ENV: process.env.NODE_ENV || 'development',                            // mode to run the server in, 'production' or 'development'

    // ostree
    BLOB_STORAGE_PROVIDER: EBlobStorageProvider.Fs,                             // blob storage provider to use
    BLOB_FS_STORAGE_DIR: './.blobs',                                            // where ostree blobs are stored when filesystem provider is being used

    // key management
    KEY_STORAGE_PROVIDER: EKeyStorageProvider.Filesystem,                       // key storage provider to use
    KEYS_FS_STORAGE_DIR: './.keys',                                             // where private keys are stored when filesystem provider is being used
    KEY_TYPE: 'rsa' as 'rsa',                                                   // the key type to use for all keys


};

export default config;
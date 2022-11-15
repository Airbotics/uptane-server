import fs from 'fs';
import path from 'path';
import config from '../../config';
import { IKeyStorageProvider } from '../../types';


/**
 * Local filesytem blob storage provider.
 * 
 * Stores blobs on local filesystem in ``config.KEYS_FS_STORAGE_DIR`` directory.
 * 
 * WARNING: This should not be used in production unless you like breaking things.
 */
export class FilesystemProvider implements IKeyStorageProvider {

    FILENAME = 'private.pem'

    async putKey(repoID: string, role: string, privKey: string): Promise<void> {

        const filePathKey = path.resolve(path.join(config.KEYS_FS_STORAGE_DIR, repoID, role, this.FILENAME));

        fs.mkdirSync(path.dirname(filePathKey), { recursive: true });

        fs.writeFileSync(filePathKey, privKey);
    }

    async getKey(repoID: string, role: string): Promise<string> {

        const filePathKey = path.resolve(path.join(config.KEYS_FS_STORAGE_DIR, repoID, role, this.FILENAME));

        return fs.readFileSync(filePathKey).toString();

    }

}


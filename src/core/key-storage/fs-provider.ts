import fs from 'fs';
import path from 'path';
import config from '../../config';
import { IKeyStorageProvider } from '../../types';


/**
 * Local filesytem key storage provider.
 * 
 * Stores keys on local filesystem in `config.KEYS_FS_STORAGE_DIR` directory.
 * 
 * WARNING: This should not be used in production unless you like breaking things.
 */
export class FilesystemProvider implements IKeyStorageProvider {

    FILENAME = 'private.pem'

    async putKey(id: string, privKey: string): Promise<void> {
        const filePathKey = path.resolve(path.join(config.KEYS_FS_STORAGE_DIR, id, this.FILENAME));
        fs.mkdirSync(path.dirname(filePathKey), { recursive: true });
        fs.writeFileSync(filePathKey, privKey);
    }

    async getKey(id: string): Promise<string> {
        const filePathKey = path.resolve(path.join(config.KEYS_FS_STORAGE_DIR, id, this.FILENAME));
        return fs.readFileSync(filePathKey).toString();
    }

    async deleteKey(id: string): Promise<void> {
        const filePathKey = path.resolve(path.join(config.KEYS_FS_STORAGE_DIR, id));
        return fs.rmdirSync(filePathKey, { recursive: true });
    }

}


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

    private keysPath: string;
    
    constructor() {
        this.keysPath = path.resolve(path.join(__filename, '..', '..', '..', '..', config.KEYS_FS_STORAGE_DIR));
        fs.mkdirSync(this.keysPath, { recursive: true });
    }

    async putKey(id: string, key: string): Promise<void> {
        const filePathKey = path.resolve(path.join(this.keysPath, id));
        fs.writeFileSync(filePathKey, key);
    }

    async getKey(id: string): Promise<string> {
        const filePathKey = path.resolve(path.join(this.keysPath, id));
        return fs.readFileSync(filePathKey).toString();
    }

    async deleteKey(id: string): Promise<void> {
        const filePathKey = path.resolve(path.join(this.keysPath, id));
        return fs.rmSync(filePathKey)
    }

}


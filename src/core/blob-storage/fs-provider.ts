import path from 'path';
import fs from 'fs';
import { IBlobStorageProvider } from '../../types';
import config from '../../config';

/**
 * Local filesytem blob storage provider.
 * 
 * Stores blobs on local filesystem in ``config.BLOB_FS_STORAGE_DIR`` directory.
 * 
 * WARNING: This should not be used in production unless you like breaking things.
 */
export class FsBlobProvider implements IBlobStorageProvider {
    
    async putObject(bucketId: string, content: Buffer): Promise<void> {
        const filePath = path.resolve(path.join(config.BLOB_FS_STORAGE_DIR, bucketId));
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, content);
    }

    async getObject(bucketId: string): Promise<Buffer | string> {
        const filePath = path.resolve(path.join(config.BLOB_FS_STORAGE_DIR, bucketId));
        return fs.readFileSync(filePath);
    }

}

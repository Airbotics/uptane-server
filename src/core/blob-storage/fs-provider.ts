import path from 'path';
import fs from 'fs';
import { IBlobStorageProvider } from '@airbotics-types';
import config from '@airbotics-config';

/**
 * Local filesytem blob storage provider.
 * 
 * Stores blobs on local filesystem in `config.BLOB_FS_STORAGE_DIR` directory.
 * 
 * WARNING: This should not be used in production unless you like breaking things.
 */
export class FsBlobProvider implements IBlobStorageProvider {

    async putObject(bucketId: string, teamId: string, objectId: string, content: Buffer | string): Promise<void> {
        const filePath = path.resolve(path.join(config.BLOB_FS_STORAGE_DIR, bucketId, teamId, objectId));
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, content);
    }
    
    async getObject(bucketId: string, teamId: string, objectId: string): Promise<Buffer | string> {
        const filePath = path.resolve(path.join(config.BLOB_FS_STORAGE_DIR, bucketId, teamId, objectId));
        return fs.readFileSync(filePath);
    }

    async deleteObject(bucketId: string, teamId: string, objectId: string): Promise<void> {
        const filePath = path.resolve(path.join(config.BLOB_FS_STORAGE_DIR, bucketId, teamId, objectId));
        return fs.unlinkSync(filePath);
    }

    async deleteTeamObjects(bucketId: string, teamId: string): Promise<void> {
        // TODO
    }

}

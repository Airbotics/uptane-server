import path from 'path';
import fs from 'fs';
import { IBlobStorageProvider } from '@airbotics-types';
import config from '@airbotics-config';

/**
 * Local filesytem blob storage provider.
 * 
 * Stores blobs on local filesystem in `config.BLOB_FS_STORAGE_DIR` directory.
 */
export class FsBlobProvider implements IBlobStorageProvider {

    async putObject(bucketId: string, teamId: string, objectId: string, content: Buffer | string): Promise<boolean> {
        const filePath = path.resolve(path.join(config.BLOB_FS_STORAGE_DIR, bucketId, teamId, objectId));
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, content);
        return true;
    }

    async getObject(bucketId: string, teamId: string, objectId: string): Promise<Buffer> {
        const filePath = path.resolve(path.join(config.BLOB_FS_STORAGE_DIR, bucketId, teamId, objectId));
        return fs.readFileSync(filePath);
    }

    async deleteObject(bucketId: string, teamId: string, objectId: string): Promise<boolean> {
        const filePath = path.resolve(path.join(config.BLOB_FS_STORAGE_DIR, bucketId, teamId, objectId));
        fs.unlinkSync(filePath);
        return true;
    }

    async deleteTeamObjects(bucketId: string, teamId: string): Promise<boolean> {
        const filePath = path.resolve(path.join(config.BLOB_FS_STORAGE_DIR, bucketId, teamId));
        try {
            fs.rmdirSync(filePath, { recursive: true });
        } catch (e) {
            // console.log(e);
        } finally {
            return true;
        }
    }

}

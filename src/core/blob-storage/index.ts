import config from '@airbotics-config';
import { EBlobStorageProvider } from '@airbotics-core/consts';
import { IBlobStorageProvider } from '@airbotics-types';
import { FsBlobProvider } from './fs-provider';
import { s3BlobProvider } from './s3-provider';


export class BlobStorageProvider implements IBlobStorageProvider {

    private strategy: IBlobStorageProvider;

    constructor(provider: EBlobStorageProvider) {
        switch (provider) {

            case EBlobStorageProvider.Filesystem:
            default:
                this.strategy = new FsBlobProvider();
                break;

            case EBlobStorageProvider.S3:
                this.strategy = new s3BlobProvider();
                break;

        }
    }

    async putObject(bucketId: string, teamId: string, objectId: string, content: Buffer | string): Promise<boolean> {
        return this.strategy.putObject(bucketId, teamId, objectId, content);
    }

    async getObject(bucketId: string, teamId: string,objectId: string): Promise<Buffer | string> {
        return this.strategy.getObject(bucketId, teamId, objectId);
    }

    async deleteObject(bucketId: string, teamId: string,objectId: string): Promise<boolean> {
        return this.strategy.deleteObject(bucketId,teamId, objectId);
    }

    async deleteTeamObjects(bucketId: string, teamId: string): Promise<boolean> {
        return this.strategy.deleteTeamObjects(bucketId, teamId);
    }

}


export const blobStorage = new BlobStorageProvider(config.BLOB_STORAGE_PROVIDER);
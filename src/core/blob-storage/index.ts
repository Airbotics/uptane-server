import config from '@airbotics-config';
import { EBlobStorageProvider } from '@airbotics-core/consts';
import { IBlobStorageProvider } from '@airbotics-types';
import { FsBlobProvider } from './fs-provider';
import { s3BlobProvider } from './s3-provider';


class BlobStorageProvider implements IBlobStorageProvider {

    private strategy: IBlobStorageProvider;

    constructor(provider: EBlobStorageProvider) {
        switch (provider) {

            case EBlobStorageProvider.Fs:
            default:
                this.strategy = new FsBlobProvider();
                break;

            case EBlobStorageProvider.S3:
                this.strategy = new s3BlobProvider();
                break;

        }
    }

    async createBucket(bucketId: string): Promise<void> {
        return this.strategy.createBucket(bucketId);
    }

    async deleteBucket(bucketId: string): Promise<void> {
        return this.strategy.deleteBucket(bucketId);
    }

    async putObject(bucketId: string, objectId: string, content: Buffer | string): Promise<void> {
        return this.strategy.putObject(bucketId, objectId, content);
    }

    async getObject(bucketId: string, objectId: string): Promise<Buffer | string> {
        return this.strategy.getObject(bucketId, objectId);
    }

    async deleteObject(bucketId: string, objectId: string): Promise<void> {
        return this.strategy.deleteObject(bucketId, objectId);
    }

}


export const blobStorage = new BlobStorageProvider(config.BLOB_STORAGE_PROVIDER);
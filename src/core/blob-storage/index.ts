import config from '../../config';
import { EBlobStorageProvider } from '../consts';
import { IBlobStorageProvider } from '../../types';
import { FsBlobProvider } from './fs-provider';


class BlobStorageProvider implements IBlobStorageProvider {

    private strategy: IBlobStorageProvider;

    constructor(provider: EBlobStorageProvider) {
        switch (provider) {

            case EBlobStorageProvider.Fs:
            default:
                this.strategy = new FsBlobProvider();
                break;

        }
    }

    async putObject(bucketId: string, content: Buffer): Promise<void> {
        return this.strategy.putObject(bucketId, content);
    }

    async getObject(bucketId: string): Promise<Buffer | string> {
        return this.strategy.getObject(bucketId);
    }

    async deleteObject(bucketId: string): Promise<void> {
        return this.strategy.deleteObject(bucketId);
    }

}


export const blobStorage = new BlobStorageProvider(config.BLOB_STORAGE_PROVIDER);
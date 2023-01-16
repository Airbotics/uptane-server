import { TUFRepo, TUFRole } from '@prisma/client';
import { EKeyStorageProvider } from '../consts';
import { IKeyPair, IKeyStorageProvider } from '@airbotics-types';
import { FilesystemProvider } from './fs-provider';
import { AWSSecretsManagerProvider } from './aws-provider';
import config from '@airbotics-config';

export class KeyStorageProvider implements IKeyStorageProvider {

    private strategy: IKeyStorageProvider;

    constructor(provider: EKeyStorageProvider) {
        switch (provider) {

            case EKeyStorageProvider.AWS:
                this.strategy = new AWSSecretsManagerProvider();
                break;

            default:
            case EKeyStorageProvider.Filesystem:
                this.strategy = new FilesystemProvider();
                break;

        }
    }

    async putKeyPair(id: string, keypair: IKeyPair): Promise<void> {
        return this.strategy.putKeyPair(id, keypair);
    }

    async getKeyPair(id: string): Promise<IKeyPair> {
        return this.strategy.getKeyPair(id);
    }

    async deleteKeyPair(id: string): Promise<void> {
        return this.strategy.deleteKeyPair(id);
    }

}

export const keyStorage = new KeyStorageProvider(config.KEY_STORAGE_PROVIDER);
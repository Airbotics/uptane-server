import { TUFRepo, TUFRole } from '@prisma/client';
import { EKeyStorageProvider } from '../consts';
import { IKeyPair, IKeyStorageProvider } from '../../types';
import { FilesystemProvider } from './fs-provider';
import config from '../../config';

/**
 * Loads a key pair for a given repo and role in a namespace from storage
 */
export const loadKeyPair = async (namespace_id: string, repo: TUFRepo, role: TUFRole): Promise<IKeyPair> => {
    return {
        privateKey: await keyStorage.getKey(`${namespace_id}-${repo}-${role}-private.pem`),
        publicKey: await keyStorage.getKey(`${namespace_id}-${repo}-${role}-public.pem`)
    }
}

class KeyStorageProvider implements IKeyStorageProvider {

    private strategy: IKeyStorageProvider;

    constructor(provider: EKeyStorageProvider) {
        switch (provider) {

            default:
            case EKeyStorageProvider.Filesystem:
                this.strategy = new FilesystemProvider();
                break;
        }
    }

    async putKey(id: string, key: string): Promise<void> {
        return this.strategy.putKey(id, key);
    }

    async getKey(id: string): Promise<string> {
        return this.strategy.getKey(id);
    }

    async deleteKey(id: string): Promise<void> {
        return this.strategy.deleteKey(id);
    }

}

export const keyStorage = new KeyStorageProvider(config.KEY_STORAGE_PROVIDER);
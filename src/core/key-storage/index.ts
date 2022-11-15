import { EKeyStorageProvider } from '../consts';
import { IKeyStorageProvider } from '../../types';
import { FilesystemProvider } from './fs-provider';
import config from '../../config';


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

    async putKey(id: string, privKey: string): Promise<void> {
        return this.strategy.putKey(id, privKey);
    }

    async getKey(id: string): Promise<string> {
        return this.strategy.getKey(id);
    }

    async deleteKey(id: string): Promise<void> {
        return this.strategy.deleteKey(id);
    }

}

export const keyStorage = new KeyStorageProvider(config.KEY_STORAGE_PROVIDER);
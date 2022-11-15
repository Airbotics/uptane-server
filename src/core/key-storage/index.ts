import { EKeyStorageProvider } from '../consts';
import { IKeyStorageProvider } from '../../types';
import { FilesystemProvider } from './fs-provider';


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

    async putKey(repoID: string, role: string, privKey: string): Promise<void> {
        return this.strategy.putKey(repoID, role, privKey);
    }

    async getKey(repoID: string, role: string): Promise<string> {
        return this.strategy.getKey(repoID, role);
    }


}
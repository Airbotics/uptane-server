import fs from 'fs';
import path from 'path';
import config from '@airbotics-config';
import { IKeyPair, IKeyStorageProvider } from '@airbotics-types';


/**
 * Local filesytem key storage provider.
 * 
 * Stores keys on local filesystem in `config.KEYS_FS_STORAGE_DIR` directory.
 * 
 * WARNING: This should not be used in production unless you like breaking things.
 */
export class FilesystemProvider implements IKeyStorageProvider {

    // keyid has the form: <team-id>/<repo>/<role>
    // we save under: .keys/<team-id>-<repo>-<role>.json

    private keysPath: string;

    constructor() {
        this.keysPath = path.resolve(path.join(__filename, '..', '..', '..', '..', config.KEYS_FS_STORAGE_DIR));
        fs.mkdirSync(this.keysPath, { recursive: true });
    }

    async putKeyPair(id: string, keypair: IKeyPair): Promise<void> {
        const filePathKey = path.resolve(path.join(this.keysPath, `${id.replace(/\//g, '-')}.json`));
        fs.writeFileSync(filePathKey, JSON.stringify(keypair), 'ascii');
    }

    async getKeyPair(id: string): Promise<IKeyPair> {
        const filePathKey = path.resolve(path.join(this.keysPath, `${id.replace(/\//g, '-')}.json`));
        return JSON.parse(fs.readFileSync(filePathKey, 'ascii')) as IKeyPair;
    }

    async deleteKeyPair(id: string): Promise<void> {
        const filePathKey = path.resolve(path.join(this.keysPath, `${id.replace(/\//g, '-')}.json`));
        fs.rmSync(filePathKey);
    }

}


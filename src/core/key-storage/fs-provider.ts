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
    // we save under: 
    // .keys/<team-id>-<repo>-<role>-private.pem
    // .keys/<team-id>-<repo>-<role>-public.pem

    private keysPath: string;

    constructor() {
        this.keysPath = path.resolve(path.join(__filename, '..', '..', '..', '..', config.KEYS_FS_STORAGE_DIR));
        fs.mkdirSync(this.keysPath, { recursive: true });
    }

    async putKeyPair(id: string, keypair: IKeyPair): Promise<void> {
        const publicFilePathKey = path.resolve(path.join(this.keysPath, `${id.replace(/\//g, '-')}-public.pem`));
        const privateFilePathKey = path.resolve(path.join(this.keysPath, `${id.replace(/\//g, '-')}-private.pem`));
        fs.writeFileSync(publicFilePathKey, keypair.publicKey, 'ascii');
        fs.writeFileSync(privateFilePathKey, keypair.privateKey, 'ascii');
    }

    async getKeyPair(id: string): Promise<IKeyPair> {
        const publicFilePathKey = path.resolve(path.join(this.keysPath, `${id.replace(/\//g, '-')}-public.pem`));
        const privateFilePathKey = path.resolve(path.join(this.keysPath, `${id.replace(/\//g, '-')}-private.pem`));
        return {
            publicKey: fs.readFileSync(publicFilePathKey, 'ascii'),
            privateKey: fs.readFileSync(privateFilePathKey, 'ascii'),
        };
    }

    async deleteKeyPair(id: string): Promise<void> {
        const publicFilePathKey = path.resolve(path.join(this.keysPath, `${id.replace(/\//g, '-')}-public.pem`));
        const privateFilePathKey = path.resolve(path.join(this.keysPath, `${id.replace(/\//g, '-')}-private.pem`));
        fs.rmSync(publicFilePathKey);
        fs.rmSync(privateFilePathKey);
    }

}


export interface IBlobStorageProvider {
    putObject(bucketId: string, content: Buffer): Promise<void>;
    getObject(bucketId: string): Promise<Buffer | string>;
    deleteObject(bucketId: string): Promise<void>;
}

export interface IKeyStorageProvider {
    putKey(id: string, privKey: string): Promise<void>;
    getKey(id: string): Promise<string>;
    deleteKey(id: string): Promise<void>;
}

export interface IKeyPair {
    publicKey: string;
    privateKey: string;
}

export interface ITufKey {
    keytype: 'rsa' | 'ed25519' | 'ecdsa-sha2-nistp256';
    keyval: {
        public: string;
    };
    scheme: 'rsassa-pss-sha256' | 'ed25519' | 'ecdsa-sha2-nistp256';
}
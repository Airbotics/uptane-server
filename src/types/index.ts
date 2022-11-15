export interface IBlobStorageProvider {
    putObject(bucketId: string, content: Buffer): Promise<void>;
    getObject(bucketId: string): Promise<Buffer | string>;
}

export interface IKeyStorageProvider {
    putKey(repoID: string, role: string, privKey: string): Promise<void>;
    getKey(repoID: string, role: string): Promise<string>;
}
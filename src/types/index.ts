export interface IBlobStorageProvider {
    putObject(bucketId: string, content: Buffer): Promise<void>;
    getObject(bucketId: string): Promise<any>;
}
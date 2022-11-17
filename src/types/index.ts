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


/**
 * TUF
 */
export interface ISignatureTUF {
    keyid: string;
    sig: string;
}


export interface ITufKey {
    keytype: 'rsa' | 'ed25519' | 'ecdsa-sha2-nistp256';
    keyval: {
        public: string;
    };
    scheme: 'rsassa-pss-sha256' | 'ed25519' | 'ecdsa-sha2-nistp256';
}


export interface IRootSignedTUF {
    _type: 'root';
    expires: string;
    spec_version: string;
    consistent_snapshot: boolean;
    version: number;
    keys: {
        [key: string]: ITufKey;
    }
    roles: {
        root: {
            keyids: string[];
            threshold: number;
        };
        snapshot: {
            keyids: string[];
            threshold: number;
        };
        targets: {
            keyids: string[];
            threshold: number;
        };
        timestamp: {
            keyids: string[];
            threshold: number;
        };
    }
}

export interface IRootTUF {
    signatures: ISignatureTUF[];
    signed: IRootSignedTUF;
}

// the actual content of the targets.json metdata with information 
// about the images the listed as targets
export interface ITargetsImages {
    [key: string]: {
        custom?: any;
        hashes: {
            sha256: string;
            sha512: string;
        };
        length: number;
    };
}


export interface ITargetsSignedTUF {
    _type: 'targets';
    spec_version: string;
    version: number;
    expires: string;
    delegations?: any;
    targets: ITargetsImages;
}

export interface ITargetsTUF {
    signatures: ISignatureTUF[];
    signed: ITargetsSignedTUF;
}




export interface ISnapshotSignedTUF {
    _type: 'snapshot';
    spec_version: string;
    version: number;
    expires: string;
    meta: {
        [key: string]: {
            version: number;
            length?: number;
            hashes?: {
                sha256: string;
                sha512: string;
            };
        };
    };
}

export interface ISnapshotTUF {
    signatures: ISignatureTUF[];
    signed: ISnapshotSignedTUF;
}



export interface ITimestampSignedTUF {
    _type: 'timestamp';
    spec_version: string;
    version: number;
    expires: string;
    meta: {
        [key: string]: {
            version: number;
            length?: number;
            hashes?: {
                sha256: string;
                sha512: string;
            };
        };
    };
}

export interface ITimestampTUF {
    signatures: ISignatureTUF[];
    signed: ITimestampSignedTUF;
}
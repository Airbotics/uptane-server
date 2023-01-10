import { EKeyType, ESignatureScheme, ETUFRole } from '@airbotics-core/consts';

export interface IBlobStorageProvider {
    createBucket(bucketId: string): Promise<void>;
    deleteBucket(bucketId: string): Promise<void>;
    putObject(bucketId: string, objectId: string, content: Buffer | string): Promise<void>;
    getObject(bucketId: string, objectId: string): Promise<Buffer | string>;
    deleteObject(bucketId: string, objectId: string): Promise<void>;
}

export interface IKeyStorageProvider {
    putKey(id: string, privKey: string): Promise<void>;
    getKey(id: string): Promise<string>;
    deleteKey(id: string): Promise<void>;
}


/**
 * Crypto
 */
export interface IKeyPair {
    publicKey: string;
    privateKey: string;
}


/**
 * TUF
 */

export interface IHashes {
    sha256: string;
    // sha512?: string;
}

export interface ISignatureTUF {
    keyid: string;
    sig: string;
    method: ESignatureScheme;
}

export interface ITufKey {
    keytype: EKeyType;
    keyval: {
        public?: string;
        private?: string;
    };
}


export interface IRootSignedTUF {
    _type: ETUFRole.Root;
    expires: string;
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

export interface ISignedRootTUF {
    signatures: ISignatureTUF[];
    signed: IRootSignedTUF;
}

// the actual content of the targets.json metdata with information 
// about the images the listed as targets
export interface ITargetsImages {
    [key: string]: {
        custom?: any;
        hashes: IHashes,
        length: number;
    };
}


export interface ITargetsSignedTUF {
    _type: ETUFRole.Targets;
    version: number;
    expires: string;
    delegations?: any;
    targets: ITargetsImages;
}

export interface ISignedTargetsTUF {
    signatures: ISignatureTUF[];
    signed: ITargetsSignedTUF;
}




export interface ISnapshotSignedTUF {
    _type: ETUFRole.Snapshot;
    version: number;
    expires: string;
    meta: {
        [key: string]: {
            version: number;
            length?: number;
            hashes?: IHashes
        };
    };
}

export interface ISignedSnapshotTUF {
    signatures: ISignatureTUF[];
    signed: ISnapshotSignedTUF;
}



export interface ITimestampSignedTUF {
    _type: ETUFRole.Timestamp;
    version: number;
    expires: string;
    meta: {
        [key: string]: {
            version: number;
            length?: number;
            hashes?: IHashes
        };
    };
}

export interface ITimestampTUF {
    signatures: ISignatureTUF[];
    signed: ITimestampSignedTUF;
}


export interface ISignedTimestampTUF {
    signatures: ISignatureTUF[];
    signed: ITimestampSignedTUF;
}


/**
 * Director
 */

export interface IecuVersionReport {
    signatures: ISignatureTUF[],
    signed: {
        ecu_serial: string,
        attacks_detected: string,
        previous_timeserver_time: string;
        report_counter: number;
        timeserver_time: string;
        installed_image: {
            fileinfo: {
                hashes: IHashes;
                length: number;
            }
            filepath: string;
        }
    }
}

export interface IRobotManifest {
    signatures: ISignatureTUF[],
    signed: {
        primary_ecu_serial: string,
        ecu_version_manifests: { [key: string]: IecuVersionReport}, // Will need to be updated to support multiple version reports
    }
}

export interface IEcuRegistrationPayload {
    primary_ecu_serial: string;
    ecus: {
        ecu_serial: string;
        hardware_identifier: string;
        clientKey: {
            keytype: string;
            keyval: {
                public: string;
            }
        }
    }[];
}


export interface OryIdentity {
    session_id: string;
    traits: {
        id: string;
        created_at: string;
        state: string;  //active or inactive
        email: string;
        name: {
            first: string;
            last: string;
        }
    }
}

export interface ITeamDetail {
    id: string;
    name: string;
    created_at: Date;
}
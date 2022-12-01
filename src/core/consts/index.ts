// supported providers for blob storage
export const enum EBlobStorageProvider {
    Fs = 'fs',
    S3 = 's3'
}

// supported providers for key storage
export const enum EKeyStorageProvider {
    Filesystem = 'fs'
}

// default ostree config
export const OSTREE_CONFIG = `[core]
repo_version=1
mode=archive-z2`;

// roles in the tuf spec
// aktualizr requires uppercase for everything but 'root'
export const enum ETUFRole {
    Root = 'root',
    Targets = 'Targets', 
    Snapshot = 'Snapshot',
    Timestamp = 'Timestamp'
}

export const enum SignatureMethods {
    rsa = 'rsassa-pss',
    ed25519 = 'ed25519'
}

export const RootCABucket = 'root-ca';
export const RootCACertObjId = 'root-ca-cert';
export const RootCAPrivateKeyId = 'root-ca-private';
export const RootCAPublicKeyId = 'root-ca-public';

// type of image that can be deployed to a robot
// NOTE: ostree is not yet supported
export const enum ETargetFormat {
    Binary = 'BINARY',
    OsTree = 'OSTREE'
}
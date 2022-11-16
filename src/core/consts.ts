// supported providers for blob storage
export const enum EBlobStorageProvider {
    Fs = 'fs'
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
export const enum ETUFRole {
    Root = 'root',
    Targets = 'targets',
    Snapshot = 'snapshot',
    Timestamp = 'timestamp'
}
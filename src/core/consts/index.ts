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
// Notes: aktualizr requires uppercase
export const enum ETUFRole {
    Root = 'Root',
    Targets = 'Targets',
    Snapshot = 'Snapshot',
    Timestamp = 'Timestamp'
}

// hash digest lengths
export const enum EHashDigest {
    Sha256 = 'SHA256',
    Sha512 = 'SHA512'
}

// key types supported in TUF
export const enum EKeyType {
    Rsa = 'RSA',
    Ed25519 = 'ED25519',                                    // not implemented
    // EcdsaSha2Nistp256 = 'ecdsa-sha2-nistp256'               // not implemented
}

// signature schemes support in TUF
export const enum ESignatureScheme {
    RsassaPssSha256 = 'rsassa-pss', //-sha256
    Ed25519 = 'ed25519',                                    // not implemented
    // EcdsaSha2Nistp256 = 'ecdsa-sha2-nistp256'               // not implemented
}

// root bucket consts
export const RootBucket = 'root';                           // for storing various infra objects
export const RootCACertObjId = 'root-ca-cert';
export const RootCAPrivateKeyId = 'root-ca-private';
export const RootCAPublicKeyId = 'root-ca-public';
export const GatewayCertObjId = 'gateway-cert';
export const GatewayPrivateKeyId = 'gateway-private';
export const GatewayPublicKeyId = 'gateway-public';

// root cert fields
export const ROOT_CERT_COMMON_NAME = 'airbotics-root';
export const ROOT_CERT_ORGANISATION = 'Airbotics Inc.';
export const ROOT_CERT_LOCALITY = 'San Francisco';
export const ROOT_CERT_STATE = 'CA';
export const ROOT_CERT_COUNTRY = 'US';
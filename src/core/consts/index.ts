// supported providers for blob storage
export const enum EBlobStorageProvider {
    Fs = 'fs',
    S3 = 's3'
}

// supported providers for key storage
export const enum EKeyStorageProvider {
    Filesystem = 'fs',
    AWS = 'aws'
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

// used to specify which version of the tuf metadata should be fetched
export const TUF_METADATA_LATEST = -1;
export const TUF_METADATA_INITIAL = 0;

// hash digest lengths
export const enum EHashDigest {
    Sha256 = 'SHA256',
    Sha512 = 'SHA512'
}

// parts of a request which we validate 
export const enum EValidationSource {
    Body = 'body',
    Headers = 'headers',
    Query = 'query',
    Path = 'params'
}

export const enum OryTeamRelations {
    member = 'member',
    admin = 'admin'
}

export const enum OryNamespaces {
    teams = 'teams'
}

// key types supported in TUF
export const enum EKeyType {
    Rsa = 'RSA',
    // Ed25519 = 'ED25519',                                 // not implemented
    // EcdsaSha2Nistp256 = 'ecdsa-sha2-nistp256'            // not implemented
}

// signature schemes support in TUF / aktualizr
export const enum ESignatureScheme {
    RsassaPssSha256 = 'rsassa-pss-sha256',
    RsassaPss = 'rsassa-pss',                               // aktualizr sends rsassa-pss rather than rsassa-pss-sha256 for RSA keys
    // Ed25519 = 'ed25519',                                 // not implemented
    // EcdsaSha2Nistp256 = 'ecdsa-sha2-nistp256'            // not implemented
}

// root bucket consts
export const ROOT_BUCKET = 'root';                           // for storing various infra objects
export const ROOT_CA_CERT_OBJ_ID = 'root-ca-cert';
export const ROOT_CA_KEY_ID = 'root-ca-keypair';
export const GATEWAY_CERT_OBJ_ID = 'gateway-cert';
export const GATEWAY_KEY_ID = 'gateway-keypair';

// root cert fields
export const ROOT_CERT_COMMON_NAME = 'airbotics-root';
export const ROOT_CERT_ORGANISATION = 'Airbotics Inc.';
export const ROOT_CERT_LOCALITY = 'San Francisco';
export const ROOT_CERT_STATE = 'CA';
export const ROOT_CERT_COUNTRY = 'US';


// event resources
export const enum EEventResource {
    Account = 'account',
    Group = 'group',
    ImageRepoRootRole = 'image_repo_root_role',
    ImageRepoTargetsRole = 'image_repo_targets_role',
    ProvisioningCredentials = 'provisioning_credentials',
    Robot = 'robot',
    Rollout = 'rollout',
    Team = 'team',
    Image = 'image'
}

/**
 * Supported actions that can be taken on resources
 * 
 * Notes:
 * - must be in past tense
 */
export const enum EEventAction {
    Created = 'created',
    Verified = 'verified',
    LoggedIn = 'logged_in',
    DetailsUpdated = 'details_updated', // name, description, etc.
    AccountRecoveredStarted = 'account_recovery_started',
    AccountRecoveredFinished = 'account_revcovery_finished',
    Deleted = 'deleted',
    RobotAdded = 'robot_added',
    RobotRemoved = 'robot_removed',
    Signed = 'signed'
}

// types of actors that can make an event
export const enum EEventActorType {
    User = 'user',
    AirboticsBot = 'airbotics-bot',
    Robot = 'robot'
}

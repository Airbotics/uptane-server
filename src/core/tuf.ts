import { TUFRepo, TUFRole } from '@prisma/client';
import forge from 'node-forge';
import { generateHash, generateSignature } from '@airbotics-core/crypto';
import config from '@airbotics-config';
import { toCanonical } from '@airbotics-core/utils';
import {
    IKeyPair, IRootSignedTUF, ISignedRootTUF, ISnapshotSignedTUF, ISignedSnapshotTUF, ITargetsImages,
    ITargetsSignedTUF, ISignedTargetsTUF, ITimestampSignedTUF, ISignedTimestampTUF, ITufKey
} from '@airbotics-types';
import { prisma } from '@airbotics-core/drivers';
import { EHashDigest, ETUFRole, TUF_METADATA_INITIAL, TUF_METADATA_LATEST } from '@airbotics-core/consts';
import { getTUFExpiry } from '@airbotics-core/time';



/**
 * Generates a TUF key id given a public or private key as a PEM string.
 */
const genKeyId = (key: string): string => generateHash(forge.pki.pemToDer(key).getBytes(), { hashDigest: EHashDigest.Sha256 });


/**
 * Sign the _signed_ portion of a TUF role and return the full signed metadata object.
 */
const signRole = (signed: IRootSignedTUF | ITargetsSignedTUF | ISnapshotSignedTUF | ITimestampSignedTUF, keyPair: IKeyPair): ISignedRootTUF | ISignedTargetsTUF | ISignedSnapshotTUF | ISignedTimestampTUF => {

    const keyId = genKeyId(keyPair.publicKey);

    const canonicalSigned = toCanonical(signed);

    const sig = generateSignature(canonicalSigned, keyPair.privateKey, { keyType: config.TUF_KEY_TYPE });

    return {
        signatures: [{
            keyid: keyId,
            method: config.TUF_SIGNATURE_SCHEME,
            sig
        }],
        signed
    } as ISignedRootTUF | ISignedTargetsTUF | ISignedSnapshotTUF | ISignedTimestampTUF;

}



interface IGenerateTufKeyOpts {
    isPublic: boolean;
}
/**
 * Generates a TUF key given a public or private key.
 */
export const generateTufKey = (key: string, { isPublic }: IGenerateTufKeyOpts): ITufKey => ({
    keytype: config.TUF_KEY_TYPE,
    keyval: {
        ...(isPublic ? { public: key } : { private: key })
    }
});



/**
 * Fetches TUF metadata from the db.
 * 
 * Will return `null` if it does not exist.
 * 
 * `robot_id` should not be specificed if you're fetching from the image repo.
 * 
 * `version` can either be:
 * -  A `number` specifying a specific version.
 * -  TUF_METADATA_LATEST` (-1) to get the most recent / latest version.
 * - `TUF_METADATA_INITIAL` (1) to get the first / initial version.
 */
export const getTufMetadata = async (
    team_id: string,
    repo: TUFRepo,
    role: TUFRole,
    version: number,
    robot_id: string | null = null): Promise<ISignedRootTUF | ISignedTargetsTUF | ISignedSnapshotTUF | ISignedTimestampTUF | null> => {

    let metadataValue: any = null;

    if (version === TUF_METADATA_LATEST) {

        const metadata = await prisma.tufMetadata.findFirst({
            where: {
                team_id,
                repo,
                role,
                ...(robot_id !== null && { robot_id: robot_id})
            },
            orderBy: {
                version: 'desc'
            }
        });
        metadataValue = metadata ? metadata.value : null;
    }

    else {

        const metadata = await prisma.tufMetadata.findFirst({
            where: {
                team_id,
                repo,
                role,
                robot_id,
                version
            }
        });

        metadataValue = metadata ? metadata.value : null;       
    }

    return metadataValue as ISignedRootTUF | ISignedTargetsTUF | ISignedSnapshotTUF | ISignedTimestampTUF | null;

}



/**
 * Gets the lastest version number of a given role in a repo in a team.
 * 
 * Will return `0` if it does not exist. This gets the most recently created metadata and grabs its version, 
 * assumes the version column in the table is always in sync with what is stored in the metadata json field.
 */
export const getLatestMetadataVersion = async (team_id: string, repo: TUFRepo, role: TUFRole, robot_id: string | null = null): Promise<number> => {
    const latest = await getTufMetadata(team_id, repo, role, TUF_METADATA_LATEST, robot_id);
    return latest ? latest.signed.version : 0;
}



/**
 * Generate signed root metadata.
 */
export const generateSignedRoot = (ttl: (number | string)[], version: number, rootKeyPair: IKeyPair, targetsKeyPair: IKeyPair, snapshotKeyPair: IKeyPair, timestampKeyPair: IKeyPair): ISignedRootTUF => {

    // generate tuf key objects
    const rootTufKey = generateTufKey(rootKeyPair.publicKey, { isPublic: true });
    const targetsTufKey = generateTufKey(targetsKeyPair.publicKey, { isPublic: true });
    const snapshotTufKey = generateTufKey(snapshotKeyPair.publicKey, { isPublic: true });
    const timestampTufKey = generateTufKey(timestampKeyPair.publicKey, { isPublic: true });

    // get key ids for each role
    const rootKeyId = genKeyId(rootKeyPair.publicKey);
    const targetsKeyId = genKeyId(targetsKeyPair.publicKey);
    const snapshotKeyId = genKeyId(snapshotKeyPair.publicKey);
    const timestampKeyId = genKeyId(timestampKeyPair.publicKey);

    // generate the signed portion of the root metadata
    const signed: IRootSignedTUF = {
        _type: ETUFRole.Root,
        consistent_snapshot: config.TUF_CONSISTENT_SNAPSHOT,
        expires: getTUFExpiry(ttl),
        version,
        keys: {
            [rootKeyId]: rootTufKey,
            [targetsKeyId]: targetsTufKey,
            [snapshotKeyId]: snapshotTufKey,
            [timestampKeyId]: timestampTufKey,
        },
        roles: {
            root: {
                keyids: [rootKeyId],
                threshold: 1
            },
            targets: {
                keyids: [targetsKeyId],
                threshold: 1
            },
            snapshot: {
                keyids: [snapshotKeyId],
                threshold: 1
            },
            timestamp: {
                keyids: [timestampKeyId],
                threshold: 1
            }
        }
    };

    return signRole(signed, rootKeyPair) as ISignedRootTUF;

}


/**
 * Generate sign targets metadata.
 */
export const generateSignedTargets = (ttl: (number | string)[], version: number, targetsKeyPair: IKeyPair, targetsImages: ITargetsImages, custom?: any): ISignedTargetsTUF => {
    
    const signed: ITargetsSignedTUF = {
        _type: ETUFRole.Targets,
        expires: getTUFExpiry(ttl),
        version,
        targets: targetsImages,
    };

    if(custom) {
        signed['custom'] = custom;
    }

    return signRole(signed, targetsKeyPair) as ISignedTargetsTUF;

}



/**
 * Generate sign snapshot metadata.
 */
export const generateSignedSnapshot = (ttl: (number | string)[], version: number, snapshotKeyPair: IKeyPair, targetsMetadata: ISignedTargetsTUF): ISignedSnapshotTUF => {
    
    const signed: ISnapshotSignedTUF = {
        _type: ETUFRole.Snapshot,
        expires: getTUFExpiry(ttl),
        version,
        meta: {
            'targets.json': {
                version: targetsMetadata.signed.version,
                length: Buffer.byteLength(toCanonical(targetsMetadata)),
                hashes: {
                    sha256: generateHash(toCanonical(targetsMetadata), { hashDigest: EHashDigest.Sha256 })
                }
            }
        }
    };

    return signRole(signed, snapshotKeyPair) as ISignedSnapshotTUF;

}



/**
 * Generate sign timestamp metadata.
 */
export const generateSignedTimestamp = (ttl: (number | string)[], version: number, timestampKeyPair: IKeyPair, snapshotMetadata: ISignedSnapshotTUF): ISignedTimestampTUF => {

    const signed: ITimestampSignedTUF = {
        _type: ETUFRole.Timestamp,
        expires: getTUFExpiry(ttl),
        version,
        meta: {
            'snapshot.json': {
                version: snapshotMetadata.signed.version,
                length: Buffer.byteLength(toCanonical(snapshotMetadata)),
                hashes: {
                    sha256: generateHash(toCanonical(snapshotMetadata), { hashDigest: EHashDigest.Sha256 })
                }
            }
        }
    };

    return signRole(signed, timestampKeyPair) as ISignedTimestampTUF;

}
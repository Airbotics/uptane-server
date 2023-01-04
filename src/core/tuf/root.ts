import config from '@airbotics-config';
import { ETUFRole } from '@airbotics-core/consts';
import { getTUFExpiry } from '@airbotics-core/time';
import { toCanonical } from '@airbotics-core/utils';
import { generateSignature } from '@airbotics-core/crypto';
import { IKeyPair, IRootSignedTUF, IRootTUF } from '@airbotics-types';
import { generateTufKey, genKeyId } from './index';


/**
 * Creates a signed tuf root metadata object
 */
export const generateRoot = (ttl: (number | string)[], version: number, rootKeyPair: IKeyPair, targetsKeyPair: IKeyPair, snapshotKeyPair: IKeyPair, timestampKeyPair: IKeyPair): IRootTUF => {

    // generate tuf key objects
    const rootTufKey = generateTufKey(rootKeyPair.publicKey, {isPublic: true});
    const targetsTufKey = generateTufKey(targetsKeyPair.publicKey, {isPublic: true});
    const snapshotTufKey = generateTufKey(snapshotKeyPair.publicKey, {isPublic: true});
    const timestampTufKey = generateTufKey(timestampKeyPair.publicKey, {isPublic: true});

    // get key ids for each role
    const rootKeyId = genKeyId(rootTufKey);
    const targetsKeyId = genKeyId(targetsTufKey);
    const snapshotKeyId = genKeyId(snapshotTufKey);
    const timestampKeyId = genKeyId(timestampTufKey);

    // generate the signed portion of the root metadata
    const signed: IRootSignedTUF = {
        _type: ETUFRole.Root,
        consistent_snapshot: config.TUF_CONSISTENT_SNAPSHOT,
        expires: getTUFExpiry(ttl),
        spec_version: config.TUF_SPEC_VERSION,
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

    // canonicalise it
    const canonicalSigned = toCanonical(signed);

    // sign it
    const sig = generateSignature(canonicalSigned, rootKeyPair.privateKey, { keyType: config.TUF_KEY_TYPE });

    // assemble the full metadata object and return it
    return {
        signatures: [{
            keyid: rootKeyId,
            method: config.TUF_SIGNATURE_SCHEME,
            sig
        }],
        signed
    };

}
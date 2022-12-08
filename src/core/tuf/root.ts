import { ManipulateType } from 'dayjs';
import config from '@airbotics-config';
import { ETUFRole } from '@airbotics-core/consts';
import { dayjs } from '@airbotics-core/time';
import { toCanonical } from '@airbotics-core/utils';
import { generateSignature } from '@airbotics-core/crypto';
import { IKeyPair, IRootSignedTUF, IRootTUF } from '@airbotics-types';
import { generateTufKey, genKeyId } from './index';


/**
 * Creates a signed tuf root metadata object
 */
export const generateRoot = (ttl: (number|string)[], version: number, rootKeyPair: IKeyPair, targetsKeyPair: IKeyPair, snapshotKeyPair: IKeyPair, timestampKeyPair: IKeyPair): IRootTUF => {

    // generate tuf key objects
    const rootTufKey = generateTufKey(rootKeyPair.publicKey);
    const targetsTufKey = generateTufKey(targetsKeyPair.publicKey);
    const snapshotTufKey = generateTufKey(snapshotKeyPair.publicKey);
    const timestampTufKey = generateTufKey(timestampKeyPair.publicKey);

    // get key ids for each role
    const rootKeyId = genKeyId(rootTufKey);
    const targetsKeyId = genKeyId(targetsTufKey);
    const snapshotKeyId = genKeyId(snapshotTufKey);
    const timestampKeyId = genKeyId(timestampTufKey);

    // generate the signed portion of the root metadata
    const signed: IRootSignedTUF = {
        _type: ETUFRole.Root,
        consistent_snapshot: config.TUF_CONSISTENT_SNAPSHOT,
        expires: dayjs().add(ttl[0] as number, ttl[1] as ManipulateType).format(config.TUF_TIME_FORMAT),
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
    const sig = generateSignature('rsa', canonicalSigned, rootKeyPair.privateKey);

    // assemble the full metadata object and return it, phew
    return {
        signatures: [{
            keyid: rootKeyId,
            method: 'rsassa-pss-sha256',
            sig
        }],
        signed
    };

}
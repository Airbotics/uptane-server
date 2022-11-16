import config from '../../config';
import { ETUFRole } from '../consts';
import { daysFromNow, formatDate, toCanonical } from '../utils';
import { generateSignature } from '../crypto';
import { generateTufKey, genKeyId } from './index';
import { IKeyPair, IRootSignedTUF, IRootTUF } from '../../types';


/**
 * Creates a signed tuf root metadata object
 */
export const generateRoot = (ttl: number, version: number, rootPk: IKeyPair, targetsPk: IKeyPair, snapshotPk: IKeyPair, timestampPk: IKeyPair): IRootTUF => {

    // generate tuf key objects
    const rootTufKey = generateTufKey(rootPk.publicKey);
    const targetsTufKey = generateTufKey(targetsPk.publicKey);
    const snapshotTufKey = generateTufKey(snapshotPk.publicKey);
    const timestampTufKey = generateTufKey(timestampPk.publicKey);

    // get key ids for each role
    const rootKeyId = genKeyId(rootTufKey);
    const targetsKeyId = genKeyId(targetsTufKey);
    const snapshotKeyId = genKeyId(snapshotTufKey);
    const timestampKeyId = genKeyId(timestampTufKey);

    // generate the signed portion of the root metadata
    const signed: IRootSignedTUF = {
        _type: ETUFRole.Root,
        consistent_snapshot: config.TUF_CONSISTENT_SNAPSHOT,
        expires: formatDate(daysFromNow(ttl)),
        spec_version: config.TUF_SPEC_VERSION,
        version: version,
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
    const sig = generateSignature('rsa', canonicalSigned, rootPk.privateKey);

    // assemble the full metadata object and return it, phew
    return {
        signatures: [{
            keyid: rootKeyId,
            sig
        }],
        signed
    };

}
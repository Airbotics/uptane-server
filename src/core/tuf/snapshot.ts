import dayjs, { ManipulateType } from 'dayjs';
import config from '../../config';
import { ETUFRole } from '../consts';
import { toCanonical } from '../utils';
import { generateHash, generateSignature } from '../crypto';
import { generateTufKey, genKeyId } from './index';
import { IKeyPair, ISnapshotSignedTUF, ISnapshotTUF, ITargetsTUF } from '../../types';


/**
 * Creates a signed tuf snapshot metadata object
 */
export const generateSnapshot = (ttl: (number | string)[], version: number, snapshotKeyPair: IKeyPair, targetsMetadata: ITargetsTUF): ISnapshotTUF => {

    // generate tuf key object
    const snapshotTufKey = generateTufKey(snapshotKeyPair.publicKey);

    // get key id
    const snapshotKeyId = genKeyId(snapshotTufKey);

    // generate the signed portion of the snapshot metadata
    const signed: ISnapshotSignedTUF = {
        _type: ETUFRole.Snapshot,
        expires: dayjs().add(ttl[0] as number, ttl[1] as ManipulateType).format(),
        spec_version: config.TUF_SPEC_VERSION,
        version,
        meta: {
            'targets.json': {
                version: targetsMetadata.signed.version,
                // length: toCanonical(targetsMetadata).length,
                // hashes: {
                //     sha256: generateHash(toCanonical(targetsMetadata), { algorithm: 'SHA256' }),
                //     sha512: generateHash(toCanonical(targetsMetadata), { algorithm: 'SHA512' })
                // }
            }
        }
    };

    // canonicalise it
    const canonicalSigned = toCanonical(signed);

    // sign it
    const sig = generateSignature('rsa', canonicalSigned, snapshotKeyPair.privateKey);

    // assemble the full metadata object and return it, phew
    return {
        signatures: [{
            keyid: snapshotKeyId,
            sig
        }],
        signed
    };

}
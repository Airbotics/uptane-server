import config from '../../config';
import { ETUFRole } from '../consts';
import { daysFromNow, formatDate, toCanonical } from '../utils';
import { generateSignature } from '../crypto';
import { generateTufKey, genKeyId } from './index';
import { IKeyPair, ISnapshotSignedTUF, ISnapshotTUF } from '../../types';


/**
 * Creates a signed tuf snapshot metadata object
 */
export const generateSnapshot = (ttl: number, version: number, snapshotKeyPair: IKeyPair): ISnapshotTUF => {

    // generate tuf key object
    const snapshotTufKey = generateTufKey(snapshotKeyPair.publicKey);

    // get key id
    const snapshotKeyId = genKeyId(snapshotTufKey);

    // generate the signed portion of the snapshot metadata
    const signed: ISnapshotSignedTUF = {
        _type: ETUFRole.Snapshot,
        expires: formatDate(daysFromNow(ttl)),
        spec_version: config.TUF_SPEC_VERSION,
        version,
        meta: {
            'targets.json': {
                version
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
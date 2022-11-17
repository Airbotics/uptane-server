import config from '../../config';
import { ETUFRole } from '../consts';
import { daysFromNow, formatDate, toCanonical } from '../utils';
import { generateHash, generateSignature } from '../crypto';
import { generateTufKey, genKeyId } from './index';
import { IKeyPair, ISnapshotTUF, ITimestampSignedTUF, ITimestampTUF } from '../../types';


/**
 * Creates a signed tuf timestamp metadata object
 */
export const generateTimestamp = (ttl: number, version: number, timestampKeyPair: IKeyPair, snapshotMetadata: ISnapshotTUF): ITimestampTUF => {

    // generate tuf key object
    const timestampTufKey = generateTufKey(timestampKeyPair.publicKey);

    // get key id
    const timestampKeyId = genKeyId(timestampTufKey);

    // generate the signed portion of the timestamp metadata
    const signed: ITimestampSignedTUF = {
        _type: ETUFRole.Timestamp,
        expires: formatDate(daysFromNow(ttl)),
        spec_version: config.TUF_SPEC_VERSION,
        version,
        meta: {
            'snapshot.json': {
                version: snapshotMetadata.signed.version,
                // length: toCanonical(snapshotMetadata).length,
                // hashes: {
                //     sha256: generateHash(toCanonical(snapshotMetadata), { algorithm: 'SHA256' }),
                //     sha512: generateHash(toCanonical(snapshotMetadata), { algorithm: 'SHA512' })
                // }
            }
        }
    };

    // canonicalise it
    const canonicalSigned = toCanonical(signed);

    // sign it
    const sig = generateSignature('rsa', canonicalSigned, timestampKeyPair.privateKey);

    // assemble the full metadata object and return it, phew
    return {
        signatures: [{
            keyid: timestampKeyId,
            sig
        }],
        signed
    };

}
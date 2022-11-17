import config from '../../config';
import { ETUFRole } from '../consts';
import { daysFromNow, formatDate, toCanonical } from '../utils';
import { generateSignature } from '../crypto';
import { generateTufKey, genKeyId } from './index';
import { IKeyPair, ITimestampSignedTUF, ITimestampTUF } from '../../types';


/**
 * Creates a signed tuf timestamp metadata object
 */
export const generateTimestamp = (ttl: number, version: number, timestampKeyPair: IKeyPair): ITimestampTUF => {

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
                version,
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
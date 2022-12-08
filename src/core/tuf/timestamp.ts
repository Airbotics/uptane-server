import { ManipulateType } from 'dayjs';
import config from '@airbotics-config';
import { ETUFRole } from '@airbotics-core/consts';
import { dayjs } from '@airbotics-core/time';
import { toCanonical } from '@airbotics-core/utils';
import { generateSignature, generateHash } from '@airbotics-core/crypto';
import { IKeyPair, ITimestampTUF, ITimestampSignedTUF, ISnapshotTUF } from '@airbotics-types';
import { generateTufKey, genKeyId } from './index';


/**
 * Creates a signed tuf timestamp metadata object
 */
export const generateTimestamp = (ttl: (number | string)[], version: number, timestampKeyPair: IKeyPair, snapshotMetadata: ISnapshotTUF): ITimestampTUF => {

    // generate tuf key object
    const timestampTufKey = generateTufKey(timestampKeyPair.publicKey);

    // get key id
    const timestampKeyId = genKeyId(timestampTufKey);

    // generate the signed portion of the timestamp metadata
    const signed: ITimestampSignedTUF = {
        _type: ETUFRole.Timestamp,
        expires: dayjs().add(ttl[0] as number, ttl[1] as ManipulateType).format(config.TUF_TIME_FORMAT),
        spec_version: config.TUF_SPEC_VERSION,
        version,
        meta: {
            'snapshot.json': {
                version: snapshotMetadata.signed.version,
                length: Buffer.byteLength(toCanonical(snapshotMetadata)),
                hashes: {
                    sha256: generateHash(toCanonical(snapshotMetadata), { algorithm: 'SHA256' }),
                    sha512: generateHash(toCanonical(snapshotMetadata), { algorithm: 'SHA512' })
                }
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
            method: 'rsassa-pss-sha256',
            sig
        }],
        signed
    };

}
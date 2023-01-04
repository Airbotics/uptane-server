import config from '@airbotics-config';
import { EHashDigest, ETUFRole } from '@airbotics-core/consts';
import { getTUFExpiry } from '@airbotics-core/time';
import { toCanonical } from '@airbotics-core/utils';
import { generateSignature, generateHash } from '@airbotics-core/crypto';
import { IKeyPair, ITimestampTUF, ITimestampSignedTUF, ISnapshotTUF } from '@airbotics-types';
import { generateTufKey, genKeyId } from './index';


/**
 * Creates a signed tuf timestamp metadata object
 */
export const generateTimestamp = (ttl: (number | string)[], version: number, timestampKeyPair: IKeyPair, snapshotMetadata: ISnapshotTUF): ITimestampTUF => {

    // generate tuf key object
    const timestampTufKey = generateTufKey(timestampKeyPair.publicKey, {isPublic: true});

    // get key id
    const timestampKeyId = genKeyId(timestampTufKey);

    // generate the signed portion of the timestamp metadata
    const signed: ITimestampSignedTUF = {
        _type: ETUFRole.Timestamp,
        expires: getTUFExpiry(ttl),
        spec_version: config.TUF_SPEC_VERSION,
        version,
        meta: {
            'snapshot.json': {
                version: snapshotMetadata.signed.version,
                length: Buffer.byteLength(toCanonical(snapshotMetadata)),
                hashes: {
                    sha256: generateHash(toCanonical(snapshotMetadata), { hashDigest: EHashDigest.Sha256 }),
                    sha512: generateHash(toCanonical(snapshotMetadata), { hashDigest: EHashDigest.Sha512 })
                }
            }
        }
    };

    // canonicalise it
    const canonicalSigned = toCanonical(signed);

    // sign it
    const sig = generateSignature(canonicalSigned, timestampKeyPair.privateKey, { keyType: config.TUF_KEY_TYPE });

    // assemble the full metadata object and return it
    return {
        signatures: [{
            keyid: timestampKeyId,
            method: config.TUF_SIGNATURE_SCHEME,
            sig
        }],
        signed
    };

}
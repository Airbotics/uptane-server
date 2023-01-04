import config from '@airbotics-config';
import { EHashDigest, ETUFRole } from '@airbotics-core/consts';
import { getTUFExpiry } from '@airbotics-core/time';
import { toCanonical } from '@airbotics-core/utils';
import { generateSignature, generateHash } from '@airbotics-core/crypto';
import { IKeyPair, ITargetsTUF, ISnapshotTUF, ISnapshotSignedTUF } from '@airbotics-types';
import { generateTufKey, genKeyId } from './index';


/**
 * Creates a signed tuf snapshot metadata object
 */
export const generateSnapshot = (ttl: (number | string)[], version: number, snapshotKeyPair: IKeyPair, targetsMetadata: ITargetsTUF): ISnapshotTUF => {

    // generate tuf key object
    const snapshotTufKey = generateTufKey(snapshotKeyPair.publicKey, {isPublic: true});

    // get key id
    const snapshotKeyId = genKeyId(snapshotTufKey);

    // generate the signed portion of the snapshot metadata
    const signed: ISnapshotSignedTUF = {
        _type: ETUFRole.Snapshot,
        expires: getTUFExpiry(ttl),
        spec_version: config.TUF_SPEC_VERSION,
        version,
        meta: {
            'targets.json': {
                version: targetsMetadata.signed.version,
                length: Buffer.byteLength(toCanonical(targetsMetadata)),
                hashes: {
                    sha256: generateHash(toCanonical(targetsMetadata), { hashDigest: EHashDigest.Sha256 }),
                    sha512: generateHash(toCanonical(targetsMetadata), { hashDigest: EHashDigest.Sha512 })
                }
            }
        }
    };

    // canonicalise it
    const canonicalSigned = toCanonical(signed);

    // sign it
    const sig = generateSignature(canonicalSigned, snapshotKeyPair.privateKey, { keyType: config.TUF_KEY_TYPE });

    // assemble the full metadata object and return it
    return {
        signatures: [{
            keyid: snapshotKeyId,
            method: config.TUF_SIGNATURE_SCHEME,
            sig
        }],
        signed
    };

}
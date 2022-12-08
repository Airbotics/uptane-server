import { ManipulateType } from 'dayjs';
import config from '@airbotics-config';
import { ETUFRole } from '@airbotics-core/consts';
import { dayjs } from '@airbotics-core/time';
import { toCanonical } from '@airbotics-core/utils';
import { generateSignature, generateHash } from '@airbotics-core/crypto';
import { IKeyPair, ITargetsTUF, ISnapshotTUF, ISnapshotSignedTUF } from '@airbotics-types';
import { generateTufKey, genKeyId } from './index';


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
        expires: dayjs().add(ttl[0] as number, ttl[1] as ManipulateType).format(config.TUF_TIME_FORMAT),
        spec_version: config.TUF_SPEC_VERSION,
        version,
        meta: {
            'targets.json': {
                version: targetsMetadata.signed.version,
                length: Buffer.byteLength(toCanonical(targetsMetadata)),
                hashes: {
                    sha256: generateHash(toCanonical(targetsMetadata), { algorithm: 'SHA256' }),
                    sha512: generateHash(toCanonical(targetsMetadata), { algorithm: 'SHA512' })
                }
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
            method: 'rsassa-pss-sha256',
            sig
        }],
        signed
    };

}
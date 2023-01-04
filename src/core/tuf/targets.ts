import config from '@airbotics-config';
import { ETUFRole } from '@airbotics-core/consts';
import { getTUFExpiry } from '@airbotics-core/time';
import { toCanonical } from '@airbotics-core/utils';
import { generateSignature } from '@airbotics-core/crypto';
import { IKeyPair, ITargetsSignedTUF, ITargetsTUF, ITargetsImages } from '@airbotics-types';
import { generateTufKey, genKeyId } from './index';

/**
 * Creates a signed tuf targets metadata object
 */
export const generateTargets = (
    ttl: (number | string)[],
    version: number,
    targetsKeyPair: IKeyPair,
    targetsImages: ITargetsImages): ITargetsTUF => {

    // generate tuf key object
    const targetsTufKey = generateTufKey(targetsKeyPair.publicKey, {isPublic: true});

    // get key id
    const targetsKeyId = genKeyId(targetsTufKey);

    // generate the signed portion of the targets metadata
    const signed: ITargetsSignedTUF = {
        _type: ETUFRole.Targets,
        expires: getTUFExpiry(ttl),
        spec_version: config.TUF_SPEC_VERSION,
        version,
        targets: targetsImages,
    };


    // canonicalise it
    const canonicalSigned = toCanonical(signed);

    // sign it
    const sig = generateSignature(canonicalSigned, targetsKeyPair.privateKey, { keyType: config.TUF_KEY_TYPE });

    // assemble the full metadata object and return it
    return {
        signatures: [{
            keyid: targetsKeyId,
            method: config.TUF_SIGNATURE_SCHEME,
            sig
        }],
        signed
    };

}
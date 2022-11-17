import config from '../../config';
import { ETUFRole } from '../consts';
import { daysFromNow, formatDate, toCanonical } from '../utils';
import { generateSignature } from '../crypto';
import { generateTufKey, genKeyId } from './index';
import { IKeyPair, ITargetsSignedTUF, ITargetsTUF, ITargetsImages } from '../../types';


/**
 * Creates a signed tuf targets metadata object
 */
export const generateTargets = (ttl: number, version: number, targetsKeyPair: IKeyPair, targetsImages: ITargetsImages): ITargetsTUF => {

    // generate tuf key object
    const targetsTufKey = generateTufKey(targetsKeyPair.publicKey);

    // get key id
    const targetsKeyId = genKeyId(targetsTufKey);

    // generate the signed portion of the targets metadata
    const signed: ITargetsSignedTUF = {
        _type: ETUFRole.Targets,
        expires: formatDate(daysFromNow(ttl)),
        spec_version: config.TUF_SPEC_VERSION,
        version,
        targets: targetsImages
    };

    // canonicalise it
    const canonicalSigned = toCanonical(signed);

    // sign it
    const sig = generateSignature('rsa', canonicalSigned, targetsKeyPair.privateKey);

    // assemble the full metadata object and return it, phew
    return {
        signatures: [{
            keyid: targetsKeyId,
            sig
        }],
        signed
    };

}
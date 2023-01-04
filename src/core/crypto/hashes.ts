import forge from 'node-forge';
import { EHashDigest } from '@airbotics-core/consts';

interface IGenerateHashOpts {
    hashDigest: EHashDigest;
}

/**
 * Generates a hash over `payload` string.
 */
export const generateHash = (payload: string, { hashDigest }: IGenerateHashOpts): string => {

    switch (hashDigest) {

        case EHashDigest.Sha256:
            return forge.md.sha256.create().update(payload).digest().toHex();

        case EHashDigest.Sha512:
            return forge.md.sha512.create().update(payload).digest().toHex();

        default: throw new Error('unsupported hash digest');

    }

}
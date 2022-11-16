import { generateHash } from '../crypto';
import { toCanonical } from '../utils';
import { generateRoot } from './root';
import { ITufKey } from '../../types';

/**
 * Generates a TUF key given a public key.
 */
export const generateTufKey = (publicKey: string): ITufKey => ({
    keytype: 'rsa',
    scheme: 'rsassa-pss-sha256',
    keyval: {
        public: publicKey
    }
});


/**
 * Generates a key id given a TUF key
 */
export const genKeyId = (roleKey: ITufKey): string => generateHash(toCanonical(roleKey), { algorithm: 'SHA256' });


// export the remaining tuf functions
export {
    generateRoot
};
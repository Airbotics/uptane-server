import { generateKeyPairSync } from 'crypto';
import { IKeyPair } from '../../types';


/**
 * Generate an RSA key pair.
 */
const generateRsaKeyPair = () => {

    const { publicKey, privateKey } = generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: {
            type: 'pkcs1',
            format: 'pem'
        },
        privateKeyEncoding: {
            type: 'pkcs8',
            format: 'pem',
        }
    });

    return {
        publicKey: publicKey.toString(),
        privateKey: privateKey.toString()
    };

}


/**
 * Generate an asymmetric key pair.
 * 
 * Options are:
 * - `rsa`
 */
export const generateKeyPair = (keyType: 'rsa'): IKeyPair => {
    switch (keyType) {
        case 'rsa': return generateRsaKeyPair();
        default: throw new Error('unsupported key type');
    }
}
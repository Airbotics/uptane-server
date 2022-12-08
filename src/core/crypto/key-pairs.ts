import forge from 'node-forge';
import { IKeyPair } from '@airbotics-types';


/**
 * Generate an RSA key pair.
 */
const generateRsaKeyPair = () => {

    const keyPair = forge.pki.rsa.generateKeyPair(2048);

    return {
        publicKey: forge.pki.publicKeyToPem(keyPair.publicKey),
        privateKey: forge.pki.privateKeyToPem(keyPair.privateKey)
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
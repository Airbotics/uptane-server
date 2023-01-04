import forge from 'node-forge';
import { generateKeyPairSync } from 'crypto';
import { IKeyPair } from '@airbotics-types';
import { EKeyType } from '@airbotics-core/consts';


interface IGenerateKeyPairOpts {
    keyType: EKeyType;
}

/**
 * Generate an asymmetric key pair.
 */
export const generateKeyPair = ({ keyType }: IGenerateKeyPairOpts): IKeyPair => {

    switch (keyType) {

        case EKeyType.Rsa:
            const rsakeyPair = forge.pki.rsa.generateKeyPair(2048);

            return {
                publicKey: forge.pki.publicKeyToPem(rsakeyPair.publicKey),
                privateKey: forge.pki.privateKeyToPem(rsakeyPair.privateKey)
            };

        case EKeyType.Ed25519:

            // note: cannot use node-forge
            const { publicKey, privateKey } = generateKeyPairSync('ed25519');

            return {
                publicKey: publicKey.export({ format: 'pem', type: 'spki' }).toString('utf-8'),
                privateKey: privateKey.export({ format: 'pem', type: 'pkcs8' }).toString('utf-8')
            };




        default: throw new Error('unsupported key type');
    }

}
import forge from 'node-forge';
import { IKeyPair } from '@airbotics-types';
import { EKeyType } from '@airbotics-core/consts';


interface IGenerateKeyPairOpts {
    keyType: EKeyType;
}

/**
 * Generate an asymmetric key pair.
 * 
 * Note: node-forge uses CRLF line endings in PEM-formatted RSA keys
 */
export const generateKeyPair = ({ keyType }: IGenerateKeyPairOpts): IKeyPair => {

    switch (keyType) {

        case EKeyType.Rsa:
            const rsakeyPair = forge.pki.rsa.generateKeyPair(2048);

            return {
                publicKey: forge.pki.publicKeyToPem(rsakeyPair.publicKey),
                privateKey: forge.pki.privateKeyToPem(rsakeyPair.privateKey)
            };

        default: throw new Error('unsupported key type');
    }

}
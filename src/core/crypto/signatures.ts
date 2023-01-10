import forge from 'node-forge';
import { EKeyType, ESignatureScheme } from '@airbotics-core/consts';


interface IGenerateSignatureOpts {
    keyType: EKeyType;
}

/**
 * Signs a string using a private key and returns it in base64.
 */
export const generateSignature = (toSign: string, privateKey: string, { keyType }: IGenerateSignatureOpts): string => {

    switch (keyType) {

        case EKeyType.Rsa:

            const digest = forge.md.sha256.create();
            digest.update(toSign, 'utf8');

            const pss = forge.pss.create({
                md: forge.md.sha256.create(),
                mgf: forge.mgf.mgf1.create(forge.md.sha256.create()),
                saltLength: digest.digestLength
            });

            return forge.util.encode64(forge.pki.privateKeyFromPem(privateKey).sign(digest, pss));

        default: throw new Error('unsupported key type');
    }

}


interface IVerifySignatureOpts {
    signatureScheme: ESignatureScheme;
}

/**
 * Verifies a base64 signature over a payload string using a public key and returns a boolean.
 */
export const verifySignature = (payload: string, signature: string, publicKey: string, { signatureScheme }: IVerifySignatureOpts): boolean => {

    switch (signatureScheme) {

        case ESignatureScheme.RsassaPssSha256:

            const digest = forge.md.sha256.create();
            digest.update(payload, 'utf8');

            const pss = forge.pss.create({
                md: forge.md.sha256.create(),
                mgf: forge.mgf.mgf1.create(forge.md.sha256.create()),
                saltLength: digest.digestLength
            });

            return forge.pki.publicKeyFromPem(publicKey).verify(digest.digest().getBytes(), forge.util.decode64(signature), pss);

        default: throw new Error('unsupported key type');
    }

}
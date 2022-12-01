import forge from 'node-forge';
import { keyStorage } from '../src/core/key-storage';
import { blobStorage } from '../src/core/blob-storage';
import { generateCertificate } from '../src/core/crypto';
import {
    RootCABucket,
    RootCACertObjId,
    RootCAPrivateKeyId,
    RootCAPublicKeyId,
    CertBucket
} from '../src/core/consts';
import { ICertOpts } from '../src/core/crypto/certificates';


/**
 * Create a cert that is signed by the AirboticsRootCA
 * with a given common name
 * 
 * Writes the generated cert to blob storage in the certs bucket
 * Writes the certs public and private keys to key storage
 */
const createCert = async (name: string, commonName: string) => {

    // load root CA cert and private key
    const rootCaPrivateKey: string = await keyStorage.getKey(RootCAPrivateKeyId);
    const rootCaPublicKey: string = await keyStorage.getKey(RootCAPublicKeyId);
    const rootCaCertPem: string = await blobStorage.getObject(RootCABucket, RootCACertObjId) as string;
    const rootCaCert = forge.pki.certificateFromPem(rootCaCertPem);

    // Ensure the cert being generated will be issues by the root CA
    const opts: ICertOpts = {
        commonName: commonName,
        cert: rootCaCert,
        keyPair: {
            privateKey: forge.pki.privateKeyFromPem(rootCaPrivateKey),
            publicKey: forge.pki.publicKeyFromPem(rootCaPublicKey)
        }
    };

    //Generate a key pair and then create the cert
    const certKeyPair = forge.pki.rsa.generateKeyPair(2048);
    const cert = generateCertificate(certKeyPair, opts);

    //Throw the cert in blob storage and the keys in key storage
    await blobStorage.createBucket(CertBucket);
    await blobStorage.putObject(CertBucket, name, forge.pki.certificateToPem(cert));

    await keyStorage.putKey(`${name}-cert-private`, forge.pki.privateKeyToPem(certKeyPair.privateKey));
    await keyStorage.putKey(`${name}-cert-public`, forge.pki.publicKeyToPem(certKeyPair.publicKey));

}


/**
 * Delete a cert that was signed by the AirboticsRootCA
 * with a given common name
 * 
 * Deletes the cert from blob storage
 * Deletes the certs public and private keys from key storage
 */
const deleteCert = async (name: string) => {
    try {
        await keyStorage.deleteKey(`${name}-cert-private`);
        await keyStorage.deleteKey(`${name}-cert-public`);
        await blobStorage.deleteObject(CertBucket, name);
    }
    catch(e) {
        console.log('Could not delete cert');        
    }

}

if(process.argv.length < 4){
    console.log('You must provide an arg for read/write and another for the common name');
    process.exit(-1);
}


switch (process.argv[2]) {

    case 'create':
        createCert(process.argv[3], process.argv[4]);
        break;

    case 'delete':
        deleteCert(process.argv[3]);
        break;
    
    default:
        console.log('unknown');
        break;
}
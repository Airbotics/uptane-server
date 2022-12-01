import forge from 'node-forge';
import { keyStorage } from '../src/core/key-storage';
import { blobStorage } from '../src/core/blob-storage';
import { generateCertificate } from '../src/core/crypto';
import {
    RootCABucket,
    RootCACertObjId,
    RootCAPrivateKeyId,
    RootCAPublicKeyId,
    GatewayCertBucket,
    GatewayCertObjId,
    GatewayPrivateKeyId,
    GatewayPublicKeyId
} from '../src/core/consts';


const createCACert = async () => {

    const rootCaKeyPair = forge.pki.rsa.generateKeyPair(2048);

    const rootCaCert = generateCertificate(rootCaKeyPair);

    await blobStorage.createBucket(RootCABucket);
    await blobStorage.putObject(RootCABucket, RootCACertObjId, forge.pki.certificateToPem(rootCaCert));

    await keyStorage.putKey(RootCAPrivateKeyId, forge.pki.privateKeyToPem(rootCaKeyPair.privateKey));
    await keyStorage.putKey(RootCAPublicKeyId, forge.pki.publicKeyToPem(rootCaKeyPair.publicKey));

}


const deleteCACert = async () => {
    await keyStorage.deleteKey(RootCAPrivateKeyId);
    await keyStorage.deleteKey(RootCAPublicKeyId);
    await blobStorage.deleteBucket(RootCABucket);
}


const createGatewayCert = async () => {

    // load root ca and key, used to sign provisioning cert
    const rootCaPrivateKeyStr = await keyStorage.getKey(RootCAPrivateKeyId);
    const rootCaPublicKeyStr = await keyStorage.getKey(RootCAPublicKeyId);
    const rootCaCertStr = await blobStorage.getObject(RootCABucket, RootCACertObjId) as string;
    const rootCaCert = forge.pki.certificateFromPem(rootCaCertStr);

    // generate a gateway cert using root ca as parent
    const opts = {
        commonName: 'bot',
        cert: rootCaCert,
        keyPair: {
            privateKey: forge.pki.privateKeyFromPem(rootCaPrivateKeyStr),
            publicKey: forge.pki.publicKeyFromPem(rootCaPublicKeyStr)
        }
    };

    const gatewayKeyPair = forge.pki.rsa.generateKeyPair(2048);

    const gatewayCert = generateCertificate(gatewayKeyPair, opts);

    await blobStorage.createBucket(GatewayCertBucket);
    await blobStorage.putObject(GatewayCertBucket, 'bot', forge.pki.certificateToPem(gatewayCert));

    await keyStorage.putKey(GatewayPrivateKeyId, forge.pki.privateKeyToPem(gatewayKeyPair.privateKey));
    await keyStorage.putKey(GatewayPublicKeyId, forge.pki.publicKeyToPem(gatewayKeyPair.publicKey));

}




switch (process.argv[2]) {

    case 'create-root-ca':
        createCACert();
        break;

    case 'delete-root-ca':
        deleteCACert();
        break;
    
    case 'create-gateway':
        createGatewayCert();
        break;

    default:
        console.log('not supported');
        break;
}
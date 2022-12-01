import forge from 'node-forge';
import { keyStorage } from '../src/core/key-storage';
import { blobStorage } from '../src/core/blob-storage';
import { generateCertificate } from '../src/core/crypto';
import {
    RootCABucket,
    RootCACertObjId,
    RootCAPrivateKeyId,
    RootCAPublicKeyId
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






switch (process.argv[2]) {

    case 'create-root-ca':
        createCACert();
        break;

    case 'delete-root-ca':
        deleteCACert();
        break;
    
        
    default:
        console.log('not supported');
        break;
}
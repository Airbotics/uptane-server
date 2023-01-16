/**
 * A helper script for performing various jobs while developing.
 * Here to make our lives easier. Not necessarily to be used for production.
 */
import forge from 'node-forge';
import readlineSync from 'readline-sync';
import { keyStorage } from '../src/core/key-storage';
import { blobStorage } from '../src/core/blob-storage';
import { generateCertificate, generateKeyPair, ICertOpts } from '../src/core/crypto';
import {
    ROOT_BUCKET,
    ROOT_CA_CERT_OBJ_ID,
    GATEWAY_CERT_OBJ_ID,
    ROOT_CA_KEY_ID,
    GATEWAY_KEY_ID,
    EKeyType
} from '../src/core/consts';


interface ICmd {
    prompt: string;
    run: () => Promise<void>;
}

const createAllCerts: ICmd = {
    prompt: 'Create root and gateway cert',
    run: async () => {

        console.log('Creating root and gateway cert');

        // generate key pair for root cert
        const rootCaKeyPair = generateKeyPair({ keyType: EKeyType.Rsa });

        // generate root cert
        const rootCaCert = generateCertificate(rootCaKeyPair);

        // generate key pair for gateway cert
        const gatewayKeyPair = generateKeyPair({ keyType: EKeyType.Rsa });

        // opts for gateway cert
        const opts: ICertOpts = {
            commonName: 'localhost',
            parentCert: rootCaCert,
            parentKeyPair: {
                privateKey: rootCaKeyPair.privateKey,
                publicKey: rootCaKeyPair.publicKey
            }
        };

        // generate gateway cert
        const gatewayCert = generateCertificate(gatewayKeyPair, opts);

        // store everything
        await blobStorage.createBucket(ROOT_BUCKET);
        await blobStorage.putObject(ROOT_BUCKET, ROOT_CA_CERT_OBJ_ID, forge.pki.certificateToPem(rootCaCert));
        await blobStorage.putObject(ROOT_BUCKET, GATEWAY_CERT_OBJ_ID, forge.pki.certificateToPem(gatewayCert));
        await keyStorage.putKeyPair(ROOT_CA_KEY_ID, {
            publicKey: rootCaKeyPair.publicKey, 
            privateKey: rootCaKeyPair.privateKey
        });
        await keyStorage.putKeyPair(GATEWAY_KEY_ID, {
            publicKey: gatewayKeyPair.publicKey, 
            privateKey: gatewayKeyPair.privateKey
        });

    }
};

const deleteAllCerts: ICmd = {
    prompt: 'Delete root and gateway cert',
    run: async () => {

        console.log('Deleting root and gateway cert');

        await blobStorage.deleteBucket(ROOT_BUCKET);

        await keyStorage.deleteKeyPair(ROOT_CA_KEY_ID);
        await keyStorage.deleteKeyPair(GATEWAY_KEY_ID);

    }
};

const commands = [
    createAllCerts,
    deleteAllCerts
];


const main = async () => {

    const index = readlineSync.keyInSelect(commands.map(command => command.prompt), 'Howdy, what can I help with?');

    // user isn't interested
    if (index === -1) {
        console.log('So long');
        process.exit(0);
    }

    // run the command
    await commands[index].run();

    console.log('Thanks for your time');

}

main();
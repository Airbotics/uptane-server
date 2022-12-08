/**
 * A helper script for performing various jobs while developing.
 * Here to make our lives easier. Not necessarily to be used for production.
 */
import forge from 'node-forge';
import readlineSync from 'readline-sync';
import { keyStorage } from '../src/core/key-storage';
import { blobStorage } from '../src/core/blob-storage';
import { generateCertificate, ICertOpts } from '../src/core/crypto';
import {
    RootBucket,
    RootCACertObjId,
    RootCAPrivateKeyId,
    RootCAPublicKeyId,
    GatewayCertObjId,
    GatewayPrivateKeyId,
    GatewayPublicKeyId
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
        const rootCaKeyPair = forge.pki.rsa.generateKeyPair(2048);

        // generate root cert
        const rootCaCert = generateCertificate(rootCaKeyPair);

        // generate key pair for gateway cert
        const gatewayKeyPair = forge.pki.rsa.generateKeyPair(2048);

        // opts for gateway cert
        const opts: ICertOpts = {
            commonName: 'localhost',
            cert: rootCaCert,
            keyPair: {
                privateKey: rootCaKeyPair.privateKey,
                publicKey: rootCaKeyPair.publicKey
            }
        };

        // generate gateway cert
        const gatewayCert = generateCertificate(gatewayKeyPair, opts);

        // store everything
        await blobStorage.createBucket(RootBucket);
        await blobStorage.putObject(RootBucket, RootCACertObjId, forge.pki.certificateToPem(rootCaCert));
        await blobStorage.putObject(RootBucket, GatewayCertObjId, forge.pki.certificateToPem(gatewayCert));
        await keyStorage.putKey(RootCAPrivateKeyId, forge.pki.privateKeyToPem(rootCaKeyPair.privateKey));
        await keyStorage.putKey(RootCAPublicKeyId, forge.pki.publicKeyToPem(rootCaKeyPair.publicKey));
        await keyStorage.putKey(GatewayPrivateKeyId, forge.pki.privateKeyToPem(gatewayKeyPair.privateKey));
        await keyStorage.putKey(GatewayPublicKeyId, forge.pki.publicKeyToPem(gatewayKeyPair.publicKey));


    }
};

const deleteAllCerts: ICmd = {
    prompt: 'Delete root and gateway cert',
    run: async () => {

        console.log('Deleting root and gateway cert');

        await blobStorage.deleteBucket(RootBucket);

        await keyStorage.deleteKey(RootCAPrivateKeyId);
        await keyStorage.deleteKey(RootCAPublicKeyId);
        await keyStorage.deleteKey(GatewayPrivateKeyId);
        await keyStorage.deleteKey(GatewayPublicKeyId);

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

    console.log('So long');

}

main();
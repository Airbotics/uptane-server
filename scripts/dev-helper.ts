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
    RootBucket,
    RootCACertObjId,
    RootCAPrivateKeyId,
    RootCAPublicKeyId,
    GatewayCertObjId,
    GatewayPrivateKeyId,
    GatewayPublicKeyId,
    EKeyType
} from '../src/core/consts';
import config from '../src/config'


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
            commonName: '172.20.10.2',
            parentCert: rootCaCert,
            parentKeyPair: {
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
        await keyStorage.putKey(RootCAPrivateKeyId, rootCaKeyPair.privateKey);
        await keyStorage.putKey(RootCAPublicKeyId, rootCaKeyPair.publicKey);
        await keyStorage.putKey(GatewayPrivateKeyId, gatewayKeyPair.privateKey);
        await keyStorage.putKey(GatewayPublicKeyId, gatewayKeyPair.publicKey);


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

    console.log('Thanks for your time');

}

main();
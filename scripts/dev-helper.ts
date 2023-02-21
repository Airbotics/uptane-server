/**
 * A helper script for performing various jobs while developing.
 * Here to make our lives easier. Not necessarily to be used for production.
 */
import forge from 'node-forge';
import readlineSync from 'readline-sync';
import { keyStorage } from '../src/core/key-storage';
import { ManipulateType } from 'dayjs';
import { randomBytes } from 'crypto';
import { acmPcaClient } from '@airbotics-core/drivers';
import { dayjs } from '@airbotics-core/time';
import { blobStorage } from '../src/core/blob-storage';
import config from '../src/config';
import { generateKeyPair } from '../src/core/crypto';
import {
    EKeyType,
    DEV_ROOT_CA_KEY_ID,
    DEV_CERTS_BUCKET,
    DEV_GATEWAY_KEY_ID,
    DEV_ROOT_CA_CERT_OBJ_ID,
    DEV_GATEWAY_CERT_OBJ_ID
} from '../src/core/consts';
import { generateCertificate } from '../src/core/crypto/certificates/utils';


interface ICmd {
    prompt: string;
    run: () => Promise<void>;
}

const createAllCerts: ICmd = {
    prompt: 'Create root and gateway cert',
    run: async () => {

        console.log('Creating root and gateway cert');

        const gatewayCommonName: string = readlineSync.question('Enter the Common Name (CN): ');

        // generate key pair for root cert
        const rootCaKeyPair = generateKeyPair({ keyType: EKeyType.Rsa });

        // generate root cert
        const rootExpiresAt = dayjs().add(config.DEV_ROOT_CA_TTL[0] as number, config.DEV_ROOT_CA_TTL[1] as ManipulateType);
        const rootCaCert = generateCertificate(rootCaKeyPair, rootExpiresAt);

        // generate key pair for gateway cert
        const gatewayKeyPair = generateKeyPair({ keyType: EKeyType.Rsa });

        // create and store gateway cert
        const gatewayExpiresAt = dayjs().add(config.DEV_GATEWAY_CA_TTL[0] as number, config.DEV_GATEWAY_CA_TTL[1] as ManipulateType);
        const gatewayCert = generateCertificate(gatewayKeyPair, gatewayExpiresAt, {
            commonName: gatewayCommonName,
            parentCert: rootCaCert,
            parentKeyPair: {
                privateKey: rootCaKeyPair.privateKey,
                publicKey: rootCaKeyPair.publicKey
            }
        });

        await blobStorage.putObject(DEV_CERTS_BUCKET, '', DEV_ROOT_CA_CERT_OBJ_ID, forge.pki.certificateToPem(rootCaCert));
        await blobStorage.putObject(DEV_CERTS_BUCKET, '', DEV_GATEWAY_CERT_OBJ_ID, forge.pki.certificateToPem(gatewayCert));

        await keyStorage.putKeyPair(DEV_ROOT_CA_KEY_ID, {
            publicKey: rootCaKeyPair.publicKey,
            privateKey: rootCaKeyPair.privateKey
        });

        await keyStorage.putKeyPair(DEV_GATEWAY_KEY_ID, {
            publicKey: gatewayKeyPair.publicKey,
            privateKey: gatewayKeyPair.privateKey
        });

    }
};


const deleteAllCerts: ICmd = {
    prompt: 'Delete root and gateway cert',
    run: async () => {

        console.log('Deleting root and gateway cert');

        await blobStorage.deleteObject(DEV_CERTS_BUCKET, '', DEV_ROOT_CA_CERT_OBJ_ID);
        await blobStorage.deleteObject(DEV_CERTS_BUCKET, '', DEV_GATEWAY_CERT_OBJ_ID);
        await keyStorage.deleteKeyPair(DEV_ROOT_CA_KEY_ID);
        await keyStorage.deleteKeyPair(DEV_GATEWAY_KEY_ID);

    }
};


const commands = [
    createAllCerts,
    deleteAllCerts
];


const main = async () => {


    const index = readlineSync.keyInSelect(commands.map(command => command.prompt), 'Howdy, what can I help with?\nPlease ensure the infra is provisioned before running this.');

    // user isn't interested
    if (index === -1) {
        console.log('Thanks for your time');
        process.exit(0);
    }

    // run the command
    await commands[index].run();

    console.log('Thanks for your time');

}

main();
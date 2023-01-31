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
import { ICertificateStorageProvider, IKeyPair, ICertificate } from '@airbotics-types';
import { dayjs } from '@airbotics-core/time';
import { blobStorage } from '../src/core/blob-storage';
import config from '../src/config';
import { generateKeyPair, certificateStorage } from '../src/core/crypto';
import {
    ROOT_CERT_ORGANISATION,
    ROOT_CERT_LOCALITY,
    ROOT_CERT_STATE,
    ROOT_CERT_COUNTRY,
    EKeyType,
    DEV_ROOT_CA_KEY_ID,
    DEV_CERTS_BUCKET,
    DEV_GATEWAY_KEY_ID,
    DEV_ROOT_CA_CERT_OBJ_ID,
    DEV_GATEWAY_CERT_OBJ_ID
} from '../src/core/consts';


export interface ICertOpts {
    commonName: string; // common name of this cert
    parentKeyPair: IKeyPair;  // key pair of the parent
    parentCert: forge.pki.Certificate; // cert of the parent cert
}


export const generateCertificate = (myKeyPair: IKeyPair, opts?: ICertOpts): forge.pki.Certificate => {

    const cert = forge.pki.createCertificate();

    const attrs: forge.pki.CertificateField[] = [
        {
            shortName: 'CN',
            value: opts ? opts.commonName : 'root'
        },
        {
            shortName: 'O',
            value: ROOT_CERT_ORGANISATION
        },
        {
            shortName: 'L',
            value: ROOT_CERT_LOCALITY
        },
        {
            shortName: 'ST',
            value: ROOT_CERT_STATE
        },
        {
            shortName: 'C',
            value: ROOT_CERT_COUNTRY
        }
    ];

    const extensions: any[] = [
        {
            name: 'basicConstraints',
            cA: !opts // if there is no opts/parent cert, then this should be set to true since it is the root ca
        },
        {
            name: 'keyUsage',
            keyCertSign: true,
            clientAuth: true,
            digitalSignature: true,
            nonRepudiation: true,
            keyEncipherment: true
        }
    ];


    // set cert fields
    cert.serialNumber = `00${randomBytes(4).toString('hex')}`;
    cert.validity.notBefore = dayjs().toDate();
    cert.validity.notAfter = dayjs().add(config.ROOT_CA_TTL[0] as number, config.ROOT_CA_TTL[1] as ManipulateType).toDate();
    cert.setExtensions(extensions);
    cert.setSubject(attrs);
    cert.setIssuer(opts ? opts.parentCert.subject.attributes : attrs);
    cert.publicKey = forge.pki.publicKeyFromPem(myKeyPair.publicKey);

    // sign the cert
    cert.sign(opts ? forge.pki.privateKeyFromPem(opts.parentKeyPair.privateKey) : forge.pki.privateKeyFromPem(myKeyPair.privateKey), forge.md.sha256.create());

    return cert;
}




interface ICmd {
    prompt: string;
    run: () => Promise<void>;
}


const createAllCerts: ICmd = {
    prompt: 'Create root and gateway cert',
    run: async () => {

        console.log('Creating root and gateway cert');

        const CN: string = readlineSync.question('Enter the Common Name (CN): ');

        // generate key pair for root cert
        const rootCaKeyPair = generateKeyPair({ keyType: EKeyType.Rsa });

        // generate root cert
        const rootCaCert = generateCertificate(rootCaKeyPair);

        // generate key pair for gateway cert
        const gatewayKeyPair = generateKeyPair({ keyType: EKeyType.Rsa });

        // create and store gateway cert
        const gatewayCert = generateCertificate(gatewayKeyPair, {
            commonName: CN,
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
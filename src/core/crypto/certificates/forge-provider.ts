import forge from 'node-forge';
import { ManipulateType } from 'dayjs';
import { randomBytes } from 'crypto';
import config from '@airbotics-config';
import { acmPcaClient } from '@airbotics-core/drivers';
import { blobStorage } from '@airbotics-core/blob-storage';
import { keyStorage } from '@airbotics-core/key-storage';
import { ICertificateStorageProvider, IKeyPair, ICertificate } from '@airbotics-types';
import { dayjs } from '@airbotics-core/time';
import {
    // ROOT_CERT_COMMON_NAME,
    ROOT_CERT_ORGANISATION,
    ROOT_CERT_LOCALITY,
    ROOT_CERT_STATE,
    ROOT_CERT_COUNTRY,
    DEV_ROOT_CA_KEY_ID,
    DEV_CERTS_BUCKET,
    DEV_ROOT_CA_CERT_OBJ_ID
} from '@airbotics-core/consts';

// const CERTS_BUCKET = 'certs';
const TEAM_ID = '';

export class ForgeCertifcateProvider implements ICertificateStorageProvider {

    // simply reads from blob storage
    async getRootCertificate(): Promise<string | null> {
        return await blobStorage.getObject(DEV_CERTS_BUCKET, TEAM_ID, DEV_ROOT_CA_CERT_OBJ_ID) as string;
    }


    // reads root cert and creates a new child cert
    async createCertificate(keyPair: IKeyPair, commonName: string, expiry: number): Promise<ICertificate | null> {

        const rootCaKeyPair = await keyStorage.getKeyPair(DEV_ROOT_CA_KEY_ID);

        const rootCaCertStr = await blobStorage.getObject(DEV_CERTS_BUCKET, TEAM_ID, DEV_ROOT_CA_CERT_OBJ_ID) as string;

        const rootCaCert = forge.pki.certificateFromPem(rootCaCertStr);

        const cert = forge.pki.createCertificate();

        const attrs: forge.pki.CertificateField[] = [
            {
                shortName: 'CN',
                value: commonName
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
                cA: false
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
        cert.validity.notAfter = new Date(expiry)
        // cert.validity.notAfter = dayjs().add(config.ROOT_CA_TTL[0] as number, config.ROOT_CA_TTL[1] as ManipulateType).toDate();
        cert.setExtensions(extensions);
        cert.setSubject(attrs);
        cert.setIssuer(rootCaCert.subject.attributes);
        cert.publicKey = forge.pki.publicKeyFromPem(keyPair.publicKey);

        // sign the cert
        cert.sign(forge.pki.privateKeyFromPem(rootCaKeyPair.privateKey), forge.md.sha256.create());

        // store cert as blob using serial
        await blobStorage.putObject(DEV_CERTS_BUCKET, TEAM_ID, cert.serialNumber, forge.pki.certificateToPem(cert));

        return {
            cert: forge.pki.certificateToPem(cert),
            serial: cert.serialNumber
        };

    }

    // reason is ignored
    async revokeCertificate(serial: string, reason: string): Promise<boolean> {
        return await blobStorage.deleteObject(DEV_CERTS_BUCKET, TEAM_ID, serial);
    }

}
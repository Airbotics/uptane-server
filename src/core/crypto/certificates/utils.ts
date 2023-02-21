import forge from 'node-forge';
import { Dayjs } from 'dayjs';
import { randomBytes } from 'crypto';
import { dayjs } from '@airbotics-core/time';
import { IKeyPair } from '@airbotics-types';
import {
    ROOT_CERT_ORGANISATION,
    ROOT_CERT_LOCALITY,
    ROOT_CERT_STATE,
    ROOT_CERT_COUNTRY,
} from '@airbotics-core/consts';


export interface ICertOpts {
    commonName: string; // common name of this cert
    parentKeyPair: IKeyPair;  // key pair of the parent
    parentCert: forge.pki.Certificate; // cert of the parent cert
}




/**
 * Helper funciton to create CSR
 */
export const generateCertificateSigningRequest = (keyPair: IKeyPair, commonName: string): string => {

    const csr = forge.pki.createCertificationRequest();
    csr.publicKey = forge.pki.publicKeyFromPem(keyPair.publicKey);

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

    csr.setSubject(attrs);
    csr.sign(forge.pki.privateKeyFromPem(keyPair.privateKey));

    return forge.pki.certificationRequestToPem(csr);

}



/**
 * Generate a certificate.
 */
export const generateCertificate = (myKeyPair: IKeyPair, expiresAt: Dayjs, opts?: ICertOpts): forge.pki.Certificate => {

    const cert = forge.pki.createCertificate();

    const attrs: forge.pki.CertificateField[] = [
        {
            shortName: 'CN',
            value: opts ? opts.commonName : 'dev-airbotics-root'
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
    cert.validity.notAfter = expiresAt.toDate();
    cert.setExtensions(extensions);
    cert.setSubject(attrs);
    cert.setIssuer(opts ? opts.parentCert.subject.attributes : attrs);
    cert.publicKey = forge.pki.publicKeyFromPem(myKeyPair.publicKey);

    // sign the cert
    cert.sign(opts ? forge.pki.privateKeyFromPem(opts.parentKeyPair.privateKey) : forge.pki.privateKeyFromPem(myKeyPair.privateKey), forge.md.sha256.create());

    return cert;
}

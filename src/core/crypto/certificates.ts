import forge from 'node-forge';
import { randomBytes } from 'crypto';
import { dayjs } from '../time';
import config from '../../config';
import { ManipulateType } from 'dayjs';

interface ICertOpts {
    commonName: string; // common name of the cert
    keyPair: forge.pki.KeyPair; // key pair of the parent
    cert: forge.pki.Certificate; // cert of the parent
}

/**
 * Generates a certificate.
 * 
 * If this is a root CA then `opts` should be `undefined`, otherwise it should be defined.
 */
export const generateCertificate = (myKeyPair: forge.pki.KeyPair, opts?: ICertOpts): forge.pki.Certificate=> {

    const cert = forge.pki.createCertificate();

    const attrs: forge.pki.CertificateField[] = [
        {
            shortName: 'CN',
            value: opts ? opts.commonName : config.ROOT_CA_CN
        },
        {
            shortName: 'O',
            value: 'Airbotics Inc.'
        },
        {
            shortName: 'L',
            value: 'San Francisco'
        },
        {
            shortName: 'ST',
            value: 'CA'
        },
        {
            shortName: 'C',
            value: 'US'
        },
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
    cert.setIssuer(opts ? opts.cert.subject.attributes : attrs);
    cert.publicKey = myKeyPair.publicKey;

    // sign the cert
    cert.sign(opts ? opts.keyPair.privateKey : myKeyPair.privateKey, forge.md.sha256.create());

    return cert;
}
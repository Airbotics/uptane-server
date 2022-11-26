import forge from 'node-forge';
import { randomBytes } from 'crypto';
import { dayjs } from '../time';
import config from '../../config';
import { ManipulateType } from 'dayjs';

interface ICertParent {
    commonName: string;
    keyPair: forge.pki.KeyPair;
    cert: forge.pki.Certificate;
}

export const generateCertificate = (myKeyPair: forge.pki.KeyPair, parent?: ICertParent): forge.pki.Certificate=> {

    const cert = forge.pki.createCertificate();

    const attrs: forge.pki.CertificateField[] = [
        {
            shortName: 'CN',
            value: parent ? parent.commonName : 'air-root'
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
            cA: !parent // if there is no parent, then this should be set to
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
    cert.setIssuer(parent ? parent.cert.subject.attributes : attrs);
    cert.publicKey = myKeyPair.publicKey;

    // sign the cert
    cert.sign(parent ? parent.keyPair.privateKey : myKeyPair.privateKey, forge.md.sha256.create());

    return cert;
}
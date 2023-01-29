import forge from 'node-forge';
import { ManipulateType } from 'dayjs';
import { IssueCertificateCommand, GetCertificateAuthorityCertificateCommand, GetCertificateCommand } from '@aws-sdk/client-acm-pca';
import { randomBytes } from 'crypto';
import config from '@airbotics-config';
import { acmPcaClient } from '@airbotics-core/drivers';
import {delay} from '@airbotics-core/utils';
import { dayjs } from '@airbotics-core/time';
import { IKeyPair } from '@airbotics-types';
import {
    ROOT_CERT_COMMON_NAME,
    ROOT_CERT_ORGANISATION,
    ROOT_CERT_LOCALITY,
    ROOT_CERT_STATE,
    ROOT_CERT_COUNTRY,
} from '@airbotics-core/consts';



/**
 * Get client certificate from ACM PCA.
 * 
 * Note: this takes a while to return...
 * 
 * TODO
 * - specify template arn
 * - handle validity
 */
export const getClientCertificate = async (csr: string): Promise<{ arn: string; cert: string; } | null> => {

    const DELAY = 5000;
    
    const issueParams = {
        CertificateAuthorityArn: config.AWS_ACM_PCA_ROOT_CA_ARN,
        Csr: Buffer.from(csr),
        SigningAlgorithm: 'SHA256WITHRSA',
        Validity: {
            Type: 'END_DATE',
            Value: 20300101000000 // YYYY-MM-DD-HH-MM-SS, 2030-01-01-00-00-00
        },
    };

    const issueCommand = new IssueCertificateCommand(issueParams);

    let certArn = null;
    try {

        const issueResponse = await acmPcaClient.send(issueCommand);

        if (issueResponse.$metadata.httpStatusCode !== 200) {
            return null;
        }

        certArn = issueResponse.CertificateArn;

    } catch (error) {
        return null;
    }

    /**
     * retry strategy does not seem to work for the client... instead we wait some secs. apologies coding gods
     */
    await delay(DELAY);

    const getParams = {
        CertificateAuthorityArn: config.AWS_ACM_PCA_ROOT_CA_ARN,
        CertificateArn: certArn
    };

    const getCommand = new GetCertificateCommand(getParams);

    try {
        const getResponse = await acmPcaClient.send(getCommand);

        if (getResponse.$metadata.httpStatusCode !== 200) {
            return null;
        }

        return {
            arn: certArn!,
            cert: getResponse.Certificate!
        };

    } catch (error) {
        return null;
    }

}


/**
 * Get the root cert from ACM PCA.
 * 
 * TODO:
 * - optimise the app to load tnis once on boot and reuse it thereafter without making a network call..
 */
export const getRootCertificate = async (): Promise<string | null> => {

    const params = {
        CertificateAuthorityArn: config.AWS_ACM_PCA_ROOT_CA_ARN
    };

    const command = new GetCertificateAuthorityCertificateCommand(params);

    try {

        const response = await acmPcaClient.send(command);

        if (response.$metadata.httpStatusCode !== 200) {
            return null;
        }

        return response.Certificate!;

    } catch (error) {
        return null;
    }

}


/**
 * Generate a certificate signing request to be submitted to ACM PCA.
 */
export const generateCertificateSigningRequest = async (myKeyPair: IKeyPair, commonName: string): Promise<string> => {

    const csr = forge.pki.createCertificationRequest();
    csr.publicKey = forge.pki.publicKeyFromPem(myKeyPair.publicKey);

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
    csr.sign(forge.pki.privateKeyFromPem(myKeyPair.privateKey));

    return forge.pki.certificationRequestToPem(csr);

}


/**
 * TODO
 * - deprecate this in favour of AWS ACM PCA
 */
export interface ICertOpts {
    commonName: string; // common name of this cert
    parentKeyPair: IKeyPair;  // key pair of the parent
    parentCert: forge.pki.Certificate; // cert of the parent cert
}

/**
 * Generates a certificate.
 * 
 * If this is a root CA then `opts` should be `undefined`, otherwise it should be defined.
 * 
 * TODO
 * - deprecate this in favour of AWS ACM PCA
 */
export const generateCertificate = (myKeyPair: IKeyPair, opts?: ICertOpts): forge.pki.Certificate => {

    const cert = forge.pki.createCertificate();

    const attrs: forge.pki.CertificateField[] = [
        {
            shortName: 'CN',
            value: opts ? opts.commonName : ROOT_CERT_COMMON_NAME
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

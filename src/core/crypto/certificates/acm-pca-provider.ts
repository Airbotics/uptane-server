import forge from 'node-forge';
import { IKeyPair } from '@airbotics-types';
import {
    IssueCertificateCommand,
    RevokeCertificateCommand,
    GetCertificateAuthorityCertificateCommand,
    GetCertificateCommand
} from '@aws-sdk/client-acm-pca';
import config from '@airbotics-config';
import { acmPcaClient } from '@airbotics-core/drivers';
import { delay } from '@airbotics-core/utils';
import {
    ROOT_CERT_ORGANISATION,
    ROOT_CERT_LOCALITY,
    ROOT_CERT_STATE,
    ROOT_CERT_COUNTRY,
} from '@airbotics-core/consts';
import { ICertificate, ICertificateStorageProvider } from '@airbotics-types';



/**
 * Helper funciton to create CSR
 */
const generateCertificateSigningRequest = (keyPair: IKeyPair, commonName: string): string => {

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



export class ACMPCACertifcateProvider implements ICertificateStorageProvider {

    // TODO optimise the app to load this once on boot and reuse it thereafter without making a network call..
    async getRootCertificate(): Promise<string | null> {

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

    // TODO forge extract serial
    // TODO handle expiry
    async createCertificate(keyPair: IKeyPair, commonName: string): Promise<ICertificate | null> {

        const csr = generateCertificateSigningRequest(keyPair, commonName);

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

        // retry strategy does not seem to work for the client... instead we wait some secs. apologies coding gods
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

            const forgeCert = forge.pki.certificateFromPem(getResponse.Certificate!);

            return {
                cert: getResponse.Certificate!,
                serial: forgeCert.serialNumber
            };

        } catch (error) {
            return null;
        }

    }

    async revokeCertificate(serial: string, reason: string): Promise<boolean> {

        const params = {
            CertificateAuthorityArn: config.AWS_ACM_PCA_ROOT_CA_ARN,
            CertificateSerial: serial,
            RevocationReason: reason
        };

        const command = new RevokeCertificateCommand(params);

        const response = await acmPcaClient.send(command);

        if (response.$metadata.httpStatusCode !== 200) {
            throw new Error();
        }

        return response.$metadata.httpStatusCode === 200;
    }

}



import { Dayjs } from 'dayjs';
import { CertificateStatus, CertificateType } from '@prisma/client';
import { IKeyPair } from '@airbotics-types';
import config from '@airbotics-config';
import { ECertificateManagerProvider } from '@airbotics-core/consts';
import { ICertificate, ICertificateManagerProvider } from '@airbotics-types';
import * as acmPcaManager from './acmpca-manager';
import * as localManager from './local-manager';

// TODO port to strategy pattern
export class CertificateManagerProvider implements ICertificateManagerProvider {

    /**
     * Fetches the root cert. 
     * 
     * Notes:
     * - for ACM PCA it makes an API call
     * - for local provider it reads from file
     * - returns as a pem formatted string or null
     */
    async getRootCertificate(): Promise<string | null> {
        switch (config.CERTIFICATE_MANAGER_PROVIDER) {
            case ECertificateManagerProvider.ACMPCA:
                return await acmPcaManager.getRootCertificate();

            case ECertificateManagerProvider.Local:
                return await localManager.getRootCertificate();
        }
    }


    /**
     * Creates a certificate.
     * 
     * Notes:
     * - this may take some time to issue (if using acm pca)
     * - for local provider we create a cert using forge and write it to a file
     * - for acm provider we create a csrc using forge and submit it to acm pca to be issued
     * - create a record in the database
     * - 
     * 
     * TODO:
     * - use transaction
     */
    async issueCertificate(teamId: string, keyPair: IKeyPair, certType: CertificateType, commonName: string, expiresAt: Dayjs): Promise<any> {
        switch (config.CERTIFICATE_MANAGER_PROVIDER) {
            case ECertificateManagerProvider.ACMPCA:
                return await acmPcaManager.issueCertificate(teamId, keyPair, certType, commonName, expiresAt);

            case ECertificateManagerProvider.Local:
                return await localManager.issueCertificate(teamId, keyPair, certType, commonName, expiresAt);
        }
    }


    /**
     * Gets a certificate that has previously been issued.
     * 
     * Notes:
     * - for the local provider it reads the cert from a file
     * - for the ACM provider it makes an api call
     * - updates status of cert in db to be issued
     * - returns `ICertificate` or null
     * 
     * TODO:
     * - use transaction
     */
    async downloadCertificate(teamId: string, certId: string): Promise<ICertificate | null> {
        switch (config.CERTIFICATE_MANAGER_PROVIDER) {
            case ECertificateManagerProvider.ACMPCA:
                return await acmPcaManager.downloadCertificate(teamId, certId);

            case ECertificateManagerProvider.Local:
                return await localManager.downloadCertificate(teamId, certId);
        }

    }


    /**
     * Revoke a certificate that has been issued.
     * 
     * Notes:
     * - can only revoke a cert that is in issued status
     * - for local provider we delete from the filesystem
     * - for ACM PCA we make an api call
     * - updates the status of the cert in the db
     * 
     * TODO:
     * - use transaction
     */
    async revokeCertificate(serial: string, reason: string): Promise<boolean> {
        switch (config.CERTIFICATE_MANAGER_PROVIDER) {
            case ECertificateManagerProvider.ACMPCA:
                return await acmPcaManager.revokeCertificate(serial, reason);

            case ECertificateManagerProvider.Local:
                return await localManager.revokeCertificate(serial, reason);
        }

    }


    /**
     * "Purge" expired certificates.
     * 
     * Notes:
     * - certificates will expire of their own accord, we just update the record in our db to reflect this
     * - we only do this for certs that have been issued to clients
     * - for the local provider we also delete from the filesystem
     * - for the acm pca provider we do nothing
     * 
     * TODO:
     * - use transaction
     */
    async purgeExpiredCertificates(): Promise<any> {
        switch (config.CERTIFICATE_MANAGER_PROVIDER) {
            case ECertificateManagerProvider.ACMPCA:
                return await acmPcaManager.purgeExpiredCertificates();

            case ECertificateManagerProvider.Local:
                return await localManager.purgeExpiredCertificates();
        }
    }

}


export const certificateManager = new CertificateManagerProvider();
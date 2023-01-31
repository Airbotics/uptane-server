import { IKeyPair } from '@airbotics-types';
import config from '@airbotics-config';
import { ECertificateStorageProvider } from '@airbotics-core/consts';
import { ICertificate, ICertificateStorageProvider } from '@airbotics-types';
import { ACMPCACertifcateProvider } from './acm-pca-provider';
import { ForgeCertifcateProvider } from './forge-provider';


export class CertificateStorageProvider implements ICertificateStorageProvider {

    private strategy: ICertificateStorageProvider;

    constructor(provider: ECertificateStorageProvider) {
        switch (provider) {

            case ECertificateStorageProvider.ACMPCA:
            default:
                this.strategy = new ACMPCACertifcateProvider();
                break;

            case ECertificateStorageProvider.Forge:
                this.strategy = new ForgeCertifcateProvider();
                break;

        }
    }

    async getRootCertificate(): Promise<string | null> {
        return this.strategy.getRootCertificate();
    }

    async createCertificate(keyPair: IKeyPair, commonName: string): Promise<ICertificate | null> {
        return this.strategy.createCertificate(keyPair, commonName);

    }

    async revokeCertificate(serial: string, reason: string): Promise<boolean> {
        return this.strategy.revokeCertificate(serial, reason);
    }

}


export const certificateStorage = new CertificateStorageProvider(config.CERTIFICATE_STORAGE_PROVIDER);
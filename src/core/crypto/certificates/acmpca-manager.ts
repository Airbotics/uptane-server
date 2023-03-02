import { randomUUID } from 'crypto';
import { Dayjs } from 'dayjs';
import {
    IssueCertificateCommand,
    RevokeCertificateCommand,
    GetCertificateAuthorityCertificateCommand,
    GetCertificateCommand
} from '@aws-sdk/client-acm-pca';
import forge from 'node-forge';
import config from '@airbotics-config';
import { prisma, acmPcaClient } from '@airbotics-core/drivers';
import { ICertificate, IKeyPair } from '@airbotics-types';
import { CertificateStatus, CertificateType } from '@prisma/client';
import { dayjs } from '@airbotics-core/time';
import { generateCertificateSigningRequest } from './utils';


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
        // console.log(error)
        return null;
    }
}



export const issueCertificate = async (teamId: string, keyPair: IKeyPair, certType: CertificateType, commonName: string, expiresAt: Dayjs): Promise<any> => {

    const csr = generateCertificateSigningRequest(keyPair, commonName);

    const issueParams = {
        CertificateAuthorityArn: config.AWS_ACM_PCA_ROOT_CA_ARN,
        Csr: Buffer.from(csr),
        SigningAlgorithm: 'SHA256WITHRSA',
        Validity: {
            Type: 'END_DATE',
            Value: Number(expiresAt.format('YYYYMMDDHHmmss')) // format - YYYY-MM-DD-HH-MM-SS, 2030-01-01-00-00-00
        },
    };

    const issueCommand = new IssueCertificateCommand(issueParams);


    const issueResponse = await acmPcaClient.send(issueCommand);

    if (issueResponse.$metadata.httpStatusCode !== 200) {
        throw new Error();
    }

    const cert = await prisma.certificate.create({
        data: {
            expires_at: expiresAt.toDate(),
            serial: `tmp-${randomUUID()}`,
            acm_arn: issueResponse.CertificateArn,
            ...(certType === CertificateType.robot && { robot_id: commonName }),
            team_id: teamId,
            cert_type: certType
        }
    });

    return cert.id;
}


export const downloadCertificate = async (teamId: string, certId: string): Promise<ICertificate | null> => {

    const dbCert = await prisma.certificate.findUnique({
        where: {
            team_id_id: {
                team_id: teamId,
                id: certId
            }
        }
    });


    // TODO check it hasnt been issued before
    
    if (!dbCert) {
        throw new Error();
    }

    const getParams = {
        CertificateAuthorityArn: config.AWS_ACM_PCA_ROOT_CA_ARN,
        CertificateArn: dbCert.acm_arn!
    };

    const getCommand = new GetCertificateCommand(getParams);

    const getResponse = await acmPcaClient.send(getCommand);

    // TODO catch
    if (getResponse.$metadata.httpStatusCode !== 200) {
        throw new Error();
    }

    const forgeCert = forge.pki.certificateFromPem(getResponse.Certificate!);

    await prisma.certificate.update({
        where: {
            team_id_id: {
                team_id: teamId,
                id: certId
            }
        },
        data: {
            status: CertificateStatus.issued,
            serial: forgeCert.serialNumber,
        }
    });
    
    return {
        cert: getResponse.Certificate!,
        expiresAt: dayjs(),
        serial: forgeCert.serialNumber
    };
}


export const revokeCertificate = async (serial: string, reason: string): Promise<boolean> => {

    const cert = await prisma.certificate.findUnique({
        where: {
            serial
        }
    });

    if (!cert) {
        // logger.error('trying to revoke a certificate that does not exist');
        throw new Error();
    }

    if (cert.status !== CertificateStatus.issued && cert.status !== CertificateStatus.issuing) {
        // logger.error('trying to revoke a certificate that has not been issued');
        throw new Error();
    }

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

    await prisma.certificate.update({
        where: {
            serial
        },
        data: {
            status: CertificateStatus.revoked,
            revoked_at: dayjs().toDate(),
            revoked_reason: reason
        }
    });

    return true;
}

export const purgeExpiredCertificates = async (): Promise<any> => {

    // Note: no need to go to aws acm pca here

    await prisma.certificate.updateMany({
        where: {
            AND: [
                {
                    expires_at: {
                        lt: dayjs().toDate(),
                    }
                },
                {
                    status: CertificateStatus.issued
                }
            ]

        },
        data: {
            status: CertificateStatus.expired,
        }
    });

}

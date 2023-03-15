import { Dayjs } from 'dayjs';
import forge from 'node-forge';
import { prisma, acmPcaClient } from '@airbotics-core/drivers';
import {blobStorage} from '@airbotics-core/blob-storage'
import { ICertificate, IKeyPair } from '@airbotics-types';
import { CertificateStatus, CertificateType } from '@prisma/client';
import { dayjs } from '@airbotics-core/time';
import { generateCertificate, generateCertificateSigningRequest } from './utils';
import { DEV_CERTS_BUCKET, DEV_ROOT_CA_CERT_OBJ_ID, DEV_ROOT_CA_KEY_ID } from '@airbotics-core/consts';
import { keyStorage } from '@airbotics-core/key-storage';


export const getRootCertificate = async (): Promise<string | null> => {
    const certBuffer = await blobStorage.getObject(DEV_CERTS_BUCKET, '', DEV_ROOT_CA_CERT_OBJ_ID);
    return certBuffer.toString();
}


export const issueCertificate = async (teamId: string, keyPair: IKeyPair, certType: CertificateType, commonName: string, expiresAt: Dayjs): Promise<any> => {

    
    const rootKeyPair = await keyStorage.getKeyPair(DEV_ROOT_CA_KEY_ID);

    const rootCert = await blobStorage.getObject(DEV_CERTS_BUCKET, '', DEV_ROOT_CA_CERT_OBJ_ID);

    const opts = {
        commonName,
        parentKeyPair: rootKeyPair,
        parentCert: forge.pki.certificateFromPem(rootCert!.toString())
    };

    
    const cert = generateCertificate(keyPair, expiresAt, opts);


    const certDb = await prisma.certificate.create({
        data: {
            expires_at: expiresAt.toDate(),
            serial: cert.serialNumber,
            acm_arn: null,
            ...(certType === CertificateType.robot && { robot_id: commonName }),
            team_id: teamId,
            cert_type: certType
        }
    });

    await blobStorage.putObject(DEV_CERTS_BUCKET, teamId, certDb.id, forge.pki.certificateToPem(cert));

    return certDb.id;
    
}


export const downloadCertificate = async (teamId: string, certId: string): Promise<ICertificate | null> => {
    
    const dbCert = await prisma.certificate.findUnique({
        where: {
            id: certId
            // team_id_id: {
            //     team_id: teamId,
            //     id: certId
            // }
        }
    });

    // TODO check it hasnt been issued before

    if (!dbCert) {
        throw new Error();
    }

    
    const certStr = await blobStorage.getObject(DEV_CERTS_BUCKET, teamId, dbCert.id);

    await prisma.certificate.update({
        where: {
            id: certId
            // team_id_id: {
            //     team_id: teamId,
            //     id: certId
            // }
        },
        data: {
            status: CertificateStatus.issued,
        }
    });

    return {
        cert: certStr.toString(),
        expiresAt: dayjs(dbCert.expires_at),
        serial: dbCert.serial
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

    await blobStorage.deleteObject(DEV_CERTS_BUCKET, cert.team_id!, cert.id);

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

    // prisma doesnt have a way to return affected rows on update many so we do a find
    // to get the ids first, then an update

    const expiredCerts = await prisma.certificate.findMany({
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
    });

    for (const cert of expiredCerts) {
        await blobStorage.deleteObject(DEV_CERTS_BUCKET, cert.team_id!, cert.id);

    }

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

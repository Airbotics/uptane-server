import { Request, Response } from 'express';
import archiver from 'archiver';
import forge from 'node-forge';
import { randomUUID } from 'crypto';
import { CertificateStatus, CertificateType, TrashResource, TUFRepo, TUFRole } from '@prisma/client';
import {
    EEventAction,
    EEventActorType,
    EEventResource,
    EKeyType,
    TUF_METADATA_INITIAL
} from '@airbotics-core/consts';
import { BadResponse, InternalServerErrorResponse, SuccessJsonResponse, SuccessMessageResponse } from '@airbotics-core/network/responses';
import { logger } from '@airbotics-core/logger';
import { prisma } from '@airbotics-core/drivers';
import { dayjs } from '@airbotics-core/time';
import { auditEvent } from '@airbotics-core/events';
import { generateKeyPair, certificateManager } from '@airbotics-core/crypto';
import config from '@airbotics-config';
import { generateTufKey, getTufMetadata } from '@airbotics-core/tuf';
import { keyStorage } from '@airbotics-core/key-storage';
import { getKeyStorageRepoKeyId, toCanonical } from '@airbotics-core/utils';
import { ICredentialsRes } from '@airbotics-types';
import { RevocationReason } from '@aws-sdk/client-acm-pca';


/**
 * Create provisioning credentials.
 * 
 * TODO
 * - potentially store public key of provisioning and client cert in db
 * - catch archive on error event
 * - transactions
 */
export const createProvisioningCredentials = async (req: Request, res: Response) => {

    const oryID = req.oryIdentity!.traits.id;
    const teamID = req.headers['air-team-id']!;
    const expiresAt = dayjs(req.body.expires_at);
    const { name } = req.body;

    const credentialId = randomUUID();

    // create the provisioning key and issue the provisioning cert, this will create it in the db
    const provisioningKeyPair = generateKeyPair({ keyType: EKeyType.Rsa });
    const provisioningCertId = await certificateManager.issueCertificate(teamID, provisioningKeyPair, CertificateType.provisioning, credentialId, expiresAt);

    // create the client key and issue the client cert, this will create it in the db
    const clientKeyPair = generateKeyPair({ keyType: EKeyType.Rsa });
    const clientCertId = await certificateManager.issueCertificate(teamID, clientKeyPair, CertificateType.client, credentialId, expiresAt);

    // temporarily save key pair
    await keyStorage.putKeyPair(provisioningCertId, provisioningKeyPair);
    await keyStorage.putKeyPair(clientCertId, clientKeyPair);

    // add record of creation of credentials to db
    const provisioningCredentials = await prisma.provisioningCredentials.create({
        data: {
            id: credentialId,
            team_id: teamID,
            name,
            status: CertificateStatus.issuing,
            expires_at: expiresAt.toDate(),
            provisioning_cert_id: provisioningCertId,
            client_cert_id: clientCertId
        }
    });

    auditEvent.emit({
        resource: EEventResource.ProvisioningCredentials,
        action: EEventAction.Created,
        actor_type: EEventActorType.User,
        actor_id: oryID,
        team_id: teamID,
        meta: {
            credentials_id: provisioningCredentials.id,
            name
        }
    });

    logger.info('provisioning credentials have been created');
    return new SuccessJsonResponse(res, { id: provisioningCredentials.id });

}



/**
 * Download a provisioning credential.
 * 
 * Notes:
 * - can only do this once
 */
export const downloadProvisioningCredential = async (req: Request, res: Response) => {

    const oryID = req.oryIdentity!.traits.id;
    const teamID = req.headers['air-team-id']!;
    const provisioningCredentialsId = req.params.credentials_id;

    const provisioningCredentials = await prisma.provisioningCredentials.findUnique({
        where: {
            team_id_id: {
                team_id: teamID,
                id: provisioningCredentialsId
            }
        }
    });

    if (!provisioningCredentials) {
        logger.warn('trying to download credentials that do not exist');
        return new BadResponse(res, 'Could not create provisioning credentials.');
    }

    if (provisioningCredentials.status !== CertificateStatus.issuing) {
        logger.warn('trying to download credentials that is not issuing');
        return new BadResponse(res, 'Could not create provisioning credentials.');
    }

    // check if the provisioning and client certs are ready
    const provisioningCert = await certificateManager.downloadCertificate(teamID, provisioningCredentials.provisioning_cert_id);

    if (!provisioningCert) {
        return new BadResponse(res, 'Could not create provisioning credentials.');
    }

    const clientCert = await certificateManager.downloadCertificate(teamID, provisioningCredentials.client_cert_id);

    if(!clientCert) {
        return new BadResponse(res, 'Could not create provisioning credentials.');
    }

    // get provisioning and client key pairs
    const provisioningKeyPair = await keyStorage.getKeyPair(provisioningCredentials.provisioning_cert_id);
    const clientKeyPair = await keyStorage.getKeyPair(provisioningCredentials.client_cert_id);


    // get the root cert from storage
    const rootCACertStr = await certificateManager.getRootCertificate();

    if (!rootCACertStr) {
        return new InternalServerErrorResponse(res);
    }

    // bundle into provisioning pcks12, no encryption password set
    const provisioningp12 = forge.pkcs12.toPkcs12Asn1(forge.pki.privateKeyFromPem(provisioningKeyPair.privateKey),
        [forge.pki.certificateFromPem(provisioningCert), forge.pki.certificateFromPem(rootCACertStr)],
        null,
        { algorithm: 'aes256' });

    const clientp12 = forge.pkcs12.toPkcs12Asn1(forge.pki.privateKeyFromPem(clientKeyPair.privateKey),
        [forge.pki.certificateFromPem(clientCert), forge.pki.certificateFromPem(rootCACertStr)],
        null,
        { algorithm: 'aes256' });

    // get initial root metadata from image repo
    const rootMetadata = await getTufMetadata(teamID, TUFRepo.image, TUFRole.root, TUF_METADATA_INITIAL);

    if (!rootMetadata) {
        logger.warn('could not create provisioning credentials because no root metadata for the team exists');
        return new BadResponse(res, 'Could not create provisioning credentials.');
    }

    const targetsKeyPair = await keyStorage.getKeyPair(getKeyStorageRepoKeyId(teamID, TUFRepo.image, TUFRole.targets));
    const targetsTufKeyPublic = generateTufKey(targetsKeyPair.publicKey, { isPublic: true });
    const targetsTufKeyPrivate = generateTufKey(targetsKeyPair.privateKey, { isPublic: false });

    // NOTE: dont include auth field since were using client mutual tls, for testing we can include: `no_auth: true`
    const treehubJson = {
        no_auth: true,
        ostree: {
            server: `${config.GATEWAY_ORIGIN}/api/v0/robot/treehub`
        }
    };

    // delete temporary key pair
    await keyStorage.deleteKeyPair(provisioningCredentials.provisioning_cert_id);
    await keyStorage.deleteKeyPair(provisioningCredentials.client_cert_id);

    // create credentials.zip
    const archive = archiver('zip');
    archive.append(Buffer.from(toCanonical(targetsTufKeyPublic), 'ascii'), { name: 'targets.pub' });
    archive.append(Buffer.from(toCanonical(targetsTufKeyPrivate), 'ascii'), { name: 'targets.sec' });
    archive.append(Buffer.from(`${config.GATEWAY_ORIGIN}/api/v0/robot/repo`, 'ascii'), { name: 'tufrepo.url' });
    archive.append(Buffer.from(`${config.API_ORIGIN}/api/v0/robot/repo/${teamID}`, 'ascii'), { name: 'tufrepo.url' });
    archive.append(Buffer.from(toCanonical(rootMetadata), 'ascii'), { name: 'root.json' });
    archive.append(Buffer.from(JSON.stringify(treehubJson), 'ascii'), { name: 'treehub.json' });
    archive.append(Buffer.from(`${config.GATEWAY_ORIGIN}/api/v0/robot`, 'ascii'), { name: 'autoprov.url' });
    archive.append(Buffer.from(forge.asn1.toDer(clientp12).getBytes(), 'binary'), { name: 'client_auth.p12' });
    archive.append(Buffer.from(forge.asn1.toDer(provisioningp12).getBytes(), 'binary'), { name: 'autoprov_credentials.p12' });
    archive.finalize();

    // update status to downloaded
    await prisma.provisioningCredentials.update({
        where: {
            team_id_id: {
                team_id: teamID,
                id: provisioningCredentialsId
            }
        },
        data: {
            status: CertificateStatus.issued
        }
    });

    auditEvent.emit({
        resource: EEventResource.ProvisioningCredentials,
        action: EEventAction.Issued,
        actor_type: EEventActorType.User,
        actor_id: oryID,
        team_id: teamID,
        meta: {
            credentials_id: provisioningCredentials.id,
            name: provisioningCredentials.name
        }
    });

    logger.info('provisioning credentials have been downloaded');

    res.set('Content-disposition', 'attachment; filename=credentials.zip');
    res.set('Content-Type', 'application/zip');
    res.status(200);
    archive.pipe(res);

}


/**
 * List previously issued provisioning credentials.
 */
export const listProvisioningCredentials = async (req: Request, res: Response) => {

    const teamID = req.headers['air-team-id']!;

    const provisioningCredentials = await prisma.provisioningCredentials.findMany({
        where: {
            team_id: teamID
        },
        orderBy: {
            created_at: 'desc'
        }
    });

    const credentialsSanitised: ICredentialsRes[] = provisioningCredentials.map(cred => ({
        id: cred.id,
        name: cred.name,
        status: cred.status,
        expires_at: cred.expires_at,
        created_at: cred.created_at,
        revoked_at: cred.revoked_at,
    }));

    logger.info('a user has read a list of the provisioning credentials');
    return new SuccessJsonResponse(res, credentialsSanitised);

}



/**
 * Revoke a provisioning credential.
 */
export const revokeProvisioningCredentials = async (req: Request, res: Response) => {
    
    const oryID = req.oryIdentity!.traits.id;
    const teamID = req.headers['air-team-id']!;
    const provisioningCredentialsId = req.params.credentials_id;

    const provisioningCredentials = await prisma.provisioningCredentials.findUnique({
        where: {
            team_id_id: {
                team_id: teamID,
                id: provisioningCredentialsId
            }
        },
        include: {
            client_cert: true,
            provisioning_cert: true
        }
    });

    if (!provisioningCredentials) {
        logger.warn('trying to revoke provisioning credentials that do not exist');
        return new BadResponse(res, 'Could not revoke provisioning credentials.');
    }

    if (provisioningCredentials!.status !== CertificateStatus.issued) {
        logger.warn('trying to revoke provisioning credentials that have not been issued');
        return new BadResponse(res, 'Could not revoke provisioning credentials.');
    }

    // put the certificates in the trash
    await prisma.trash.create({
        data: {
            resource_type: TrashResource.certificate,
            resource_id: provisioningCredentials.client_cert.id
        }
    });

    await prisma.trash.create({
        data: {
            resource_type: TrashResource.certificate,
            resource_id: provisioningCredentials.provisioning_cert.id
        }
    });


    // revoke the credential
    await prisma.provisioningCredentials.update({
        where: {
            team_id_id: {
                team_id: teamID,
                id: provisioningCredentialsId
            }
        },
        data: {
            status: CertificateStatus.revoked,
            revoked_at: dayjs().toDate(),
        }
    }); 
    
    auditEvent.emit({
        resource: EEventResource.ProvisioningCredentials,
        action: EEventAction.Revoked,
        actor_type: EEventActorType.User,
        actor_id: oryID,
        team_id: teamID,
        meta: {
            credentials_id: provisioningCredentials.id,
            name: provisioningCredentials.name
        }
    });

    logger.info('a user has revoked a provisioning credential');
    return new SuccessMessageResponse(res, 'You have revoked that provisioning credential.');

}

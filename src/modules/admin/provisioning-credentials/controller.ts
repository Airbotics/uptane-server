import { Request, Response } from 'express';
import archiver from 'archiver';
import forge from 'node-forge';
import { CertificateStatus, CertificateType, TUFRepo, TUFRole } from '@prisma/client';
import {
    // DEV_CERTS_BUCKET,
    // DEV_ROOT_CA_CERT_OBJ_ID,
    // DEV_ROOT_CA_KEY_ID,
    EEventAction,
    EEventActorType,
    EEventResource,
    EKeyType,
    ROOT_BUCKET,
    ROOT_CA_CERT_OBJ_ID,
    ROOT_CA_KEY_ID,
    TUF_METADATA_INITIAL
} from '@airbotics-core/consts';
import { SuccessJsonResponse } from '@airbotics-core/network/responses';
import { logger } from '@airbotics-core/logger';
import { prisma } from '@airbotics-core/drivers';
import { dayjs } from '@airbotics-core/time';
import { airEvent } from '@airbotics-core/events';
import { generateKeyPair, certificateManager } from '@airbotics-core/crypto';
import config from '@airbotics-config';
import { generateTufKey, getTufMetadata } from '@airbotics-core/tuf';
import { keyStorage } from '@airbotics-core/key-storage';
import { getKeyStorageRepoKeyId, toCanonical } from '@airbotics-core/utils';
import { ICredentialsRes } from 'src/types/responses';
import { generateCertificate } from '@airbotics-core/crypto/certificates/temp';
import { blobStorage } from '@airbotics-core/blob-storage';



export const createProvisioningCredentials = async (req: Request, res: Response) => {

    const oryID = req.oryIdentity!.traits.id;
    const teamID = req.headers['air-team-id']!;

    // create provisioning key
    const provisioningKeyPair = generateKeyPair({ keyType: EKeyType.Rsa });



    // load root ca and key, used to sign provisioning cert
    const rootCaKeyPair = await keyStorage.getKeyPair(ROOT_CA_KEY_ID);
    const rootCaCertStr = await blobStorage.getObject(ROOT_BUCKET, '', ROOT_CA_CERT_OBJ_ID) as string;
    const rootCaCert = forge.pki.certificateFromPem(rootCaCertStr);

    // generate provisioning cert using root ca as parent
    const opts = {
        commonName: teamID,
        parentCert: rootCaCert,
        parentKeyPair: rootCaKeyPair
    };
    const provisioningCert = generateCertificate(provisioningKeyPair, opts);

    // bundle into pcks12, no encryption password set
    const p12 = forge.pkcs12.toPkcs12Asn1(forge.pki.privateKeyFromPem(provisioningKeyPair.privateKey), [provisioningCert, rootCaCert], null, { algorithm: 'aes256' });



    // const clientKeyPair = generateKeyPair({ keyType: EKeyType.Rsa });
    // const clientopts = {
    //     commonName: teamID,
    //     parentCert: rootCaCert,
    //     parentKeyPair: rootCaKeyPair
    // };
    // const clientCert = generateCertificate(clientKeyPair, opts);

    // // bundle into pcks12, no encryption password set
    // const p12 = forge.pkcs12.toPkcs12Asn1(forge.pki.privateKeyFromPem(provisioningKeyPair.privateKey), [provisioningCert, rootCaCert], null, { algorithm: 'aes256' });




    // get initial root metadata
    const rootMetadata = await getTufMetadata(teamID, TUFRepo.image, TUFRole.root, TUF_METADATA_INITIAL);

    if (!rootMetadata) {
        logger.warn('could not create provisioning credentials because no root metadata for the team exists');
        return res.status(400).send('could not create provisioning credentials');
    }

    const targetsKeyPair = await keyStorage.getKeyPair(getKeyStorageRepoKeyId(teamID, TUFRepo.image, TUFRole.targets));
    const targetsTufKeyPublic = generateTufKey(targetsKeyPair.publicKey, { isPublic: true });
    const targetsTufKeyPrivate = generateTufKey(targetsKeyPair.privateKey, { isPublic: false });

    // create credentials.zip
    const treehub = {
        no_auth: true,
        ostree: {
            server: `${config.API_ORIGIN}/api/v0/robot/treehub/${teamID}`
        }
    };

    const archive = archiver('zip');
    archive.append(Buffer.from(toCanonical(targetsTufKeyPublic), 'ascii'), { name: 'targets.pub' });
    archive.append(Buffer.from(toCanonical(targetsTufKeyPrivate), 'ascii'), { name: 'targets.sec' });
    archive.append(Buffer.from(`${config.API_ORIGIN}/api/v0/robot/repo/${teamID}`, 'ascii'), { name: 'tufrepo.url' });
    archive.append(Buffer.from(toCanonical(rootMetadata), 'ascii'), { name: 'root.json' });
    archive.append(Buffer.from(JSON.stringify(treehub), 'ascii'), { name: 'treehub.json' });
    archive.append(Buffer.from(`${config.GATEWAY_ORIGIN}/api/v0/robot`, 'ascii'), { name: 'autoprov.url' });
    archive.append(Buffer.from(forge.asn1.toDer(p12).getBytes(), 'binary'), { name: 'autoprov_credentials.p12' });
    archive.finalize();


    // add record of creation of credentials to db
    // const provisioningCredentials = await prisma.provisioningCredentials.create({
    //     data: {
    //         team_id: teamID
    //     }
    // });

    // airEvent.emit({
    //     resource: EEventResource.ProvisioningCredentials,
    //     action: EEventAction.Created,
    //     actor_type: EEventActorType.User,
    //     actor_id: oryID,
    //     team_id: teamID,
    //     meta: {
    //         id: provisioningCredentials.id
    //     }
    // });

    logger.info('provisioning credentials have been created');

    res.set('content-type', 'application/zip');
    res.status(200);
    archive.pipe(res);
}


/**
 * Create provisioning credentials.
 * 
 * Note:
 * - because issuing a cert from acm pca takes some amount of seconds, this endpoint could be slow.. at least 5 secs. This can be optimised or refactored
 * 
 * TODO
 * - potentially store public key of provisioning and client cert in db
 * - catch archive on error event
 * - transaction
 */
/*
export const createProvisioningCredentials = async (req: Request, res: Response) => {

    const oryID = req.oryIdentity!.traits.id;
    const teamID = req.headers['air-team-id']!;
    const expires_at = dayjs(req.body.expires_at);
    const { name } = req.body;

    // create the provisioning key and issue the provisioning cert, this will create it in the db
    const provisioningKeyPair = generateKeyPair({ keyType: EKeyType.Rsa });
    const provisioningCertId = await certificateManager.issueCertificate(teamID, provisioningKeyPair, CertificateType.provisioning, teamID, dayjs(expires_at));

    // create the client key and issue the client cert, this will create it in the db
    const clientKeyPair = generateKeyPair({ keyType: EKeyType.Rsa });
    const clientCertId = await certificateManager.issueCertificate(teamID, clientKeyPair, CertificateType.client, teamID, dayjs(expires_at));

    // temporarily save key pair
    await keyStorage.putKeyPair(provisioningCertId, provisioningKeyPair);
    await keyStorage.putKeyPair(clientCertId, clientKeyPair);

    // add record of creation of credentials to db
    const provisioningCredentials = await prisma.provisioningCredentials.create({
        data: {
            team_id: teamID,
            name,
            status: CertificateStatus.issuing,
            expires_at: expires_at.toDate(),
            provisioning_cert_id: provisioningCertId,
            client_cert_id: clientCertId
        }
    });

    airEvent.emit({
        resource: EEventResource.ProvisioningCredentials,
        action: EEventAction.Created,
        actor_type: EEventActorType.User,
        actor_id: oryID,
        team_id: teamID,
        meta: {
            id: provisioningCredentials.id,
            name
        }
    });

    logger.info('provisioning credentials have been created');
    return res.status(200).json({id: provisioningCredentials.id });

}
*/


/**
 * Download a provisioning credential.
 * 
 * Notes:
 * must exist, must be in an issuing state
 * change status
 * can only do this once
 */
/*
export const downloadProvisioningCredential = async (req: Request, res: Response) => {

    const oryID = req.oryIdentity!.traits.id;
    const teamID = req.headers['air-team-id']!;
    const provisioningCredentialsId = req.params.id;

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
        return res.status(400).end();
    }

    if (provisioningCredentials.status !== CertificateStatus.issuing) {
        logger.warn('trying to download credentials that is not issuing');
        return res.status(400).end();
    }

    // get the root cert from storage
    const rootCACertStr = await certificateManager.getRootCertificate();

    if (!rootCACertStr) {
        return res.status(500).end();
    }

    // get provisioning cert and key
    const provisioningCert = await certificateManager.downloadCertificate(teamID, provisioningCredentials.provisioning_cert_id);

    if(!provisioningCert) {
        return res.status(400).end();
    }

    const provisioningKeyPair = await keyStorage.getKeyPair(provisioningCredentials.provisioning_cert_id);

    // get client cert and key
    const clientCert = await certificateManager.downloadCertificate(teamID, provisioningCredentials.client_cert_id);

    if(!clientCert) {
        return res.status(400).end();
    }

    const clientKeyPair = await keyStorage.getKeyPair(provisioningCredentials.client_cert_id);

    // bundle into provisioning pcks12, no encryption password set
    const provisioningp12 = forge.pkcs12.toPkcs12Asn1(forge.pki.privateKeyFromPem(provisioningKeyPair.privateKey),
        [forge.pki.certificateFromPem(provisioningCert.cert), forge.pki.certificateFromPem(rootCACertStr)],
        null,
        { algorithm: 'aes256' });

    // bundle into client auth pcks12, no encryption password set
    const clientp12 = forge.pkcs12.toPkcs12Asn1(forge.pki.privateKeyFromPem(clientKeyPair.privateKey),
        [forge.pki.certificateFromPem(clientCert.cert), forge.pki.certificateFromPem(rootCACertStr)],
        null,
        { algorithm: 'aes256' });


    // get initial root metadata from image repo
    const rootMetadata = await getTufMetadata(teamID, TUFRepo.image, TUFRole.root, TUF_METADATA_INITIAL);

    if (!rootMetadata) {
        logger.warn('could not create provisioning credentials because no root metadata for the team exists');
        return res.status(400).send('could not create provisioning credentials');
    }

    const targetsKeyPair = await keyStorage.getKeyPair(getKeyStorageRepoKeyId(teamID, TUFRepo.image, TUFRole.targets));
    const targetsTufKeyPublic = generateTufKey(targetsKeyPair.publicKey, { isPublic: true });
    const targetsTufKeyPrivate = generateTufKey(targetsKeyPair.privateKey, { isPublic: false });

    // NOTE: dont include auth field since were using client mutual tls, for testing we can include: `no_auth: true`
    const treehubJson = {
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

    airEvent.emit({
        resource: EEventResource.ProvisioningCredentials,
        action: EEventAction.Issued,
        actor_type: EEventActorType.User,
        actor_id: oryID,
        team_id: teamID,
        meta: {
            id: provisioningCredentials.id
        }
    });

    logger.info('provisioning credentials have been downloaded');

    res.set('Content-disposition', 'attachment; filename=credentials.zip');
    res.set('Content-Type', 'application/zip');
    res.status(200);
    archive.pipe(res);
}
*/

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
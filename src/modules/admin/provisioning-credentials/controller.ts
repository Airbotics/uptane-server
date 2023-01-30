import { Request, Response } from 'express';
import archiver from 'archiver';
import forge from 'node-forge';
import { ProvisioningCredentialsStatus, TUFRepo, TUFRole } from '@prisma/client';
import {
    EEventAction,
    EEventActorType,
    EEventResource,
    EKeyType,
    TUF_METADATA_INITIAL
} from '@airbotics-core/consts';
import { SuccessJsonResponse } from '@airbotics-core/network/responses';
import { logger } from '@airbotics-core/logger';
import { prisma } from '@airbotics-core/drivers';
import { airEvent } from '@airbotics-core/events';
import { generateKeyPair, certificateStorage } from '@airbotics-core/crypto';
import config from '@airbotics-config';
import { generateTufKey, getTufMetadata } from '@airbotics-core/tuf';
import { keyStorage } from '@airbotics-core/key-storage';
import { getKeyStorageRepoKeyId, toCanonical } from '@airbotics-core/utils';


/**
 * Create provisioning credentials.
 * 
 * Note:
 * - because issuing a cert from acm pca takes some amount of seconds, this endpoint could be slow.. at least 5 secs. This can be optimised or refactored
 * 
 * TODO
 * - potentially store public key of provisioning crednetials in db
 * - save arn in db
 * - catch archive on error event
 */
export const createProvisioningCredentials = async (req: Request, res: Response) => {

    const oryID = req.oryIdentity!.traits.id;
    const teamID = req.headers['air-team-id']!;

    // create provisioning key
    const provisioningKeyPair = generateKeyPair({ keyType: EKeyType.Rsa });

    // get the provisioning cert
    // NOTE this takes a while if fetching from acm pca
    const provisioningCert = await certificateStorage.createCertificate(provisioningKeyPair, teamID);

    if (!provisioningCert) {
        return res.status(500).end();
    }

    // get the root cert from storage
    const rootCACertSr = await certificateStorage.getRootCertificate();

    if (!rootCACertSr) {
        return res.status(500).end();
    }

    // bundle into pcks12, no encryption password set
    const p12 = forge.pkcs12.toPkcs12Asn1(forge.pki.privateKeyFromPem(provisioningKeyPair.privateKey),
        [forge.pki.certificateFromPem(provisioningCert.cert), forge.pki.certificateFromPem(rootCACertSr)],
        null,
        { algorithm: 'aes256' });

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
    // TODO include auth
    const treehub = {
        no_auth: true,
        ostree: {
            server: `${config.MAIN_SERVER_ORIGIN}/api/v0/robot/treehub/${teamID}`
        }
    };

    const archive = archiver('zip');
    archive.append(Buffer.from(toCanonical(targetsTufKeyPublic), 'ascii'), { name: 'targets.pub' });
    archive.append(Buffer.from(toCanonical(targetsTufKeyPrivate), 'ascii'), { name: 'targets.sec' });
    archive.append(Buffer.from(`${config.MAIN_SERVER_ORIGIN}/api/v0/robot/repo/${teamID}`, 'ascii'), { name: 'tufrepo.url' });
    archive.append(Buffer.from(toCanonical(rootMetadata), 'ascii'), { name: 'root.json' });
    archive.append(Buffer.from(JSON.stringify(treehub), 'ascii'), { name: 'treehub.json' });
    archive.append(Buffer.from(`${config.ROBOT_GATEWAY_ORIGIN}/api/v0/robot`, 'ascii'), { name: 'autoprov.url' });
    archive.append(Buffer.from(forge.asn1.toDer(p12).getBytes(), 'binary'), { name: 'autoprov_credentials.p12' });
    archive.finalize();

    // add record of creation of credentials to db
    const provisioningCredentials = await prisma.provisioningCredentials.create({
        data: {
            team_id: teamID,
            status: ProvisioningCredentialsStatus.downloaded,
            cert_serial: provisioningCert.serial
        }
    });

    airEvent.emit({
        resource: EEventResource.ProvisioningCredentials,
        action: EEventAction.Created,
        actor_type: EEventActorType.User,
        actor_id: oryID,
        team_id: teamID,
        meta: {
            id: provisioningCredentials.id
        }
    });


    logger.info('provisioning credentials have been created');

    res.set('content-type', 'application/zip');
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

    const credentialsSanitised = provisioningCredentials.map(cred => ({
        id: cred.id,
        status: cred.status,
        created_at: cred.created_at
    }));

    logger.info('A user read a list of the provisioning credentials');
    return new SuccessJsonResponse(res, credentialsSanitised);

}



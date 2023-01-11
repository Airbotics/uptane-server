import { Request, Response, NextFunction } from 'express';
import { ory } from '@airbotics-core/drivers/ory';
import { IdentityApiGetIdentityRequest, RelationshipApiGetRelationshipsRequest, RelationshipApiPatchRelationshipsRequest } from '@ory/client';
import { EKeyType, OryNamespaces, OryTeamRelations, ROOT_BUCKET, ROOT_CA_CERT_OBJ_ID, Root_CA_PRIVATE_KEY_ID, Root_CA_PUBLIC_KEY_ID } from '@airbotics-core/consts';
import { SuccessMessageResponse, BadResponse, SuccessJsonResponse, NoContentResponse } from '@airbotics-core/network/responses';
import { logger } from '@airbotics-core/logger';
import prisma from '@airbotics-core/postgres';
import { ITeamDetail, OryIdentity } from 'src/types';
import { auditEventEmitter } from '@airbotics-core/events';
import { generateCertificate, generateKeyPair } from '@airbotics-core/crypto';
import config from '@airbotics-config';
import { generateSignedRoot, generateSignedSnapshot, generateSignedTargets, generateSignedTimestamp, generateTufKey, getInitialMetadata } from '@airbotics-core/tuf';
import { TUFRepo, TUFRole } from '@prisma/client';
import { blobStorage } from '@airbotics-core/blob-storage';
import { keyStorage, loadKeyPair } from '@airbotics-core/key-storage';
import archiver from 'archiver';
import forge from 'node-forge';
import { v4 as uuidv4 } from 'uuid';
import { toCanonical } from '@airbotics-core/utils';


/**
 * Create a provisioning credentials
 * 
 * TODO
 * - catch archive on error event
 * - record credentials creation in db to enable revocation, expiry, auditing, etc.
 */
export const createProvisioningCredentials = async (req: Request, res: Response, next: NextFunction) => {
    
    const oryID = req.oryIdentity!.traits.id;
    const teamID = req.params.team_id;

    // create provisioning key, this will not be stored
    const provisioningKeyPair = generateKeyPair({ keyType: EKeyType.Rsa }); 

    // load root ca and key, used to sign provisioning cert
    const rootCaPrivateKeyStr = await keyStorage.getKey(Root_CA_PRIVATE_KEY_ID);
    const rootCaPublicKeyStr = await keyStorage.getKey(Root_CA_PUBLIC_KEY_ID);
    const rootCaCertStr = await blobStorage.getObject(ROOT_BUCKET, ROOT_CA_CERT_OBJ_ID) as string;
    const rootCaCert = forge.pki.certificateFromPem(rootCaCertStr);

    // generate provisioning cert using root ca as parent
    const opts = {
        commonName: teamID,
        parentCert: rootCaCert,
        parentKeyPair: {
            privateKey: rootCaPrivateKeyStr,
            publicKey: rootCaPublicKeyStr
        }
    };
    const provisioningCert = generateCertificate(provisioningKeyPair, opts);

    // bundle into pcks12, no encryption password set
    const p12 = forge.pkcs12.toPkcs12Asn1(forge.pki.privateKeyFromPem(provisioningKeyPair.privateKey), [provisioningCert, rootCaCert], null, { algorithm: 'aes256' });

    // get initial root metadata
    const rootMetadata = await getInitialMetadata(teamID, TUFRepo.image, TUFRole.root);

    if (!rootMetadata) {
        logger.warn('could not create provisioning credentials because no root metadata for the team exists');
        return res.status(400).send('could not create provisioning credentials');
    }

    const targetsKeyPair = await loadKeyPair(teamID, TUFRepo.image, TUFRole.targets);
    const targetsTufKeyPublic = generateTufKey(targetsKeyPair.publicKey, { isPublic: true });
    const targetsTufKeyPrivate = generateTufKey(targetsKeyPair.privateKey, { isPublic: false });

    // create credentials.zip
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

    auditEventEmitter.emit({ actor_id: oryID, team_id: teamID, action: 'create_provisioning_creds' });

    // add record of creation of credentials to db
    await prisma.provisioningCredentials.create({
        data: {
            team_id: teamID
        }
    });

    logger.info('provisioning credentials have been created');

    res.set('content-type', 'application/zip');
    res.status(200);
    archive.pipe(res);
}




export const listProvisioningCredentials = async (req: Request, res: Response, next: NextFunction) => {

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
        created_at: cred.created_at
    }));
    
    logger.info('A user read a list of the provisioning credentials');
    return new SuccessJsonResponse(res, credentialsSanitised);

}



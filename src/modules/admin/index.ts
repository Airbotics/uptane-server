import express , { Request, Response, NextFunction } from 'express';
import { UploadStatus, TUFRepo, TUFRole, ImageFormat } from '@prisma/client';
import archiver from 'archiver';
import forge from 'node-forge';
import { v4 as uuidv4 } from 'uuid';
import { loadKeyPair } from '@airbotics-core/key-storage';
import { generateHash } from '@airbotics-core/crypto';
import {
    generateSignedRoot,
    generateSignedSnapshot,
    generateSignedTargets,
    generateSignedTimestamp,
    generateTufKey,
    getInitialMetadata,
    getLatestMetadata,
    getLatestMetadataVersion
} from '@airbotics-core/tuf';
import config from '@airbotics-config';
import { prisma } from '@airbotics-core/postgres';
import { generateCertificate, generateKeyPair } from '@airbotics-core/crypto';
import { keyStorage } from '@airbotics-core/key-storage';
import { blobStorage } from '@airbotics-core/blob-storage';
import { logger } from '@airbotics-core/logger';
import {
    EHashDigest,
    EKeyType,
    OryTeamRelations,
    ROOT_BUCKET,
    ROOT_CA_CERT_OBJ_ID,
    Root_CA_PRIVATE_KEY_ID,
    Root_CA_PUBLIC_KEY_ID
} from '@airbotics-core/consts';
import { auditEventEmitter } from '@airbotics-core/events';
import { toCanonical } from '@airbotics-core/utils';
import { mustBeInTeam, mustBeAuthenticated } from 'src/middlewares';

const router = express.Router();



/**
 * Create a provisioning credentials
 * 
 * TODO
 * - catch archive on error event
 * - record credentials creation in db to enable revocation, expiry, auditing, etc.
 */
router.post('/provisioning-credentials', async (req: Request, res: Response, next: NextFunction) => {

    const oryID = req.oryIdentity!.traits.id;
    const teamID = req.params.team_id;

    const teamCount = await prisma.team.count({
        where: {
            id: teamID
        }
    });

    if (teamCount === 0) {
        logger.warn('could not create provisioning key because team does not exist');
        return res.status(400).send('could not create provisioning credentials');
    }

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

});


/**
 * Create a rollout.
 * 
 * Creates an association betwen an ecu and image.
 */
router.post('/rollouts', async (req: Request, res: Response, next: NextFunction) => {

    const {
        ecu_id,
        image_id
    } = req.body;


    const teamID = req.headers['air-team-id'];

    // check team exists
    const teamCount = await prisma.team.count({
        where: {
            id: teamID
        }
    });

    if (teamCount === 0) {
        logger.warn('could not create a rollout because team does not exist');
        return res.status(400).send('could not create rollout');
    }

    // check robot exists
    const ecuCount = await prisma.ecu.count({
        where: {
            id: ecu_id
        }
    });

    if (ecuCount === 0) {
        logger.warn('could not create a rollout because ecu does not exist');
        return res.status(400).send('could not create rollout');
    }

    // check image exists
    const imageCount = await prisma.image.count({
        where: {
            id: image_id
        }
    });

    if (imageCount === 0) {
        logger.warn('could not create a rollout because image does not exist');
        return res.status(400).send('could not create rollout');
    }

    const tmpRollout = await prisma.tmpEcuImages.create({
        data: {
            image_id,
            ecu_id
        }
    });

    const response = {
        image_id: tmpRollout.image_id,
        ecu_id: tmpRollout.ecu_id,
        created_at: tmpRollout.created_at,
        updated_at: tmpRollout.updated_at
    };

    logger.info('created tmp rollout');
    return res.status(200).json(response);

});



/**
 * Upload an image in a team.
 * 
 * This is not an upsert operation, you cannot overwrite an image once it has been uploaded.
 * You can only upload one image/target at a time.
 * 
 * For now this adds the image to blob storage but will later upload to treehub, it also signs 
 * the appropiate TUF metadata, and updates the inventory db (i.e. postgres)
 * 
 * OPERATIONS:
 * - Checks team exists.
 * - Creates a reference to the image in postgres.
 * - Uploads image to blob storage.
 * - Updates the uploadstatus of image in postgres to uploaded.
 * - Creates a new set of metadata:
 *      - Gets hashes of image.
 *      - Determines the version the new targets.json should have.
 *      - Reads keys.
 *      - Assembles new signed targets.json.
 *      - Assembles new signed snapshot.json.
 *      - Assembles new signed timestamp.json.
 * - Commits everything to db.
 * 
 * TODO:
 * - valide the size/length reported by content-length header matches the length we actually receive
 * - upload type of image along with the image - ostree, binary, etc
 * - also included could be the name of the image
 */
router.post('/images', express.raw({ type: '*/*' }), async (req: Request, res: Response) => {

    const teamID = req.headers['air-team-id']!;
    const imageContent = req.body;
    const hwids = (req.query.hwids as string).split(',');
    const format = req.query.type as ImageFormat;
    const name = req.query.name as string;

    const size = parseInt(req.get('content-length')!);

    // if content-length was not sent, or it is zero, or it is not a number return 400
    if (!size || size === 0 || isNaN(size)) {
        logger.warn('could not create an image because content-length header was not sent');
        return res.status(400).end();
    }

    // check team exists
    const teamCount = await prisma.team.count({
        where: {
            id: teamID
        }
    });

    if (teamCount === 0) {
        logger.warn('could not create an image because team does not exist');
        return res.status(400).send('could not upload image');
    }

    // get image id and hashes
    const imageId = uuidv4();
    const sha256 = generateHash(imageContent, { hashDigest: EHashDigest.Sha256 });

    // determine new version numbers
    const newTargetsVersion = await getLatestMetadataVersion(teamID, TUFRepo.image, TUFRole.targets) + 1;
    const newSnapshotVersion = await getLatestMetadataVersion(teamID, TUFRepo.image, TUFRole.snapshot) + 1;
    const newTimestampVersion = await getLatestMetadataVersion(teamID, TUFRepo.image, TUFRole.timestamp) + 1;

    // read in keys from key storage
    const targetsKeyPair = await loadKeyPair(teamID, TUFRepo.image, TUFRole.targets);
    const snapshotKeyPair = await loadKeyPair(teamID, TUFRepo.image, TUFRole.snapshot);
    const timestampKeyPair = await loadKeyPair(teamID, TUFRepo.image, TUFRole.timestamp);

    // assemble information about this image to be put in the targets.json metadata
    // we grab the previous targets portion of the targets metadata and append this new image to it
    const latestTargets = await getLatestMetadata(teamID, TUFRepo.image, TUFRole.targets);

    // const targetsImages: ITargetsImages = latestTargets ? latestTargets.signed.targets : {};
    const targetsImages = latestTargets.signed.targets;

    // NOTE: image.type is lowercase in db, but aktualizr expects uppercase
    targetsImages[imageId] = {
        custom: {
            hardwareIds: hwids,
            targetFormat: String(imageContent.type).toUpperCase(),
            uri: `${config.ROBOT_GATEWAY_ORIGIN}/api/v0/robot/repo/images/${imageId}`
        },
        length: size,
        hashes: {
            sha256,
            // sha512
        }
    };

    // generate new set of tuf metadata (apart from root)
    const targetsMetadata = generateSignedTargets(config.TUF_TTL.IMAGE.TARGETS, newTargetsVersion, targetsKeyPair, targetsImages);
    const snapshotMetadata = generateSignedSnapshot(config.TUF_TTL.IMAGE.SNAPSHOT, newSnapshotVersion, snapshotKeyPair, targetsMetadata);
    const timestampMetadata = generateSignedTimestamp(config.TUF_TTL.IMAGE.TIMESTAMP, newTimestampVersion, timestampKeyPair, snapshotMetadata);

    // perform db writes in transaction
    try {
        const image = await prisma.$transaction(async tx => {

            // create tuf metadata
            // prisma wants to be passed an `object` instead of our custom interface so we cast it
            await tx.metadata.create({
                data: {
                    team_id: teamID,
                    repo: TUFRepo.image,
                    role: TUFRole.targets,
                    version: newTargetsVersion,
                    value: targetsMetadata as object,
                    expires_at: targetsMetadata.signed.expires
                }
            });

            await tx.metadata.create({
                data: {
                    team_id: teamID,
                    repo: TUFRepo.image,
                    role: TUFRole.snapshot,
                    version: newSnapshotVersion,
                    value: snapshotMetadata as object,
                    expires_at: snapshotMetadata.signed.expires
                }
            });

            await tx.metadata.create({
                data: {
                    team_id: teamID,
                    repo: TUFRepo.image,
                    role: TUFRole.timestamp,
                    version: newTimestampVersion,
                    value: timestampMetadata as object,
                    expires_at: timestampMetadata.signed.expires
                }
            });

            // create reference to image in db
            await tx.image.create({
                data: {
                    id: imageId,
                    name: 'placeholder',
                    team_id: teamID,
                    size,
                    hwids,
                    sha256,
                    status: UploadStatus.uploading,
                    format
                }
            });

            // upload image to blob storage
            await blobStorage.putObject(teamID, `images/${imageId}`, imageContent);

            // update reference to image in db saying that it has completed uploading
            const image = await tx.image.update({
                where: {
                    team_id_id: {
                        team_id: teamID,
                        id: imageId
                    }
                },
                data: {
                    status: UploadStatus.uploaded
                }
            });

            return image;

        });

        const response = {
            id: image.id,
            size: image.size,
            sha256: image.sha256,
            hwids: image.hwids,
            status: image.status,
            created_at: image.created_at,
            updated_at: image.updated_at
        };

        logger.info('uploaded an image');
        return res.status(200).json(response);

    } catch (error) {
        if (error.code === 'P2002') {
            logger.warn('could not upload image because an image with this hash already exists');
            return res.status(400).send('could not upload image');
        }
        throw error;

    }

});


/**
 * List images in a team.
 */
router.get('/images', async (req: Request, res: Response) => {

    const teamID = req.headers['air-team-id'];

    // check team exists
    const teamCount = await prisma.team.count({
        where: {
            id: teamID
        }
    });

    if (teamCount === 0) {
        logger.warn('could not list images because team does not exist');
        return res.status(400).send('could not list images');
    }

    // get images
    const images = await prisma.image.findMany({
        where: {
            team_id: teamID
        },
        orderBy: {
            created_at: 'desc'
        }
    });

    const response = images.map(image => ({
        id: image.id,
        size: image.size,
        sha256: image.sha256,
        hwids: image.hwids,
        status: image.status,
        format: image.format,
        created_at: image.created_at,
        updated_at: image.updated_at
    }));

    return res.status(200).json(response);

});



/**
 * List robots in a team.
 */
router.get('/robots', async (req: Request, res: Response) => {

    const teamID = req.headers['air-team-id']!;

    // check team exists
    const teamCount = await prisma.team.count({
        where: {
            id: teamID
        }
    });

    if (teamCount === 0) {
        logger.warn('could not list robots because team does not exist');
        return res.status(400).send('could not list robots');
    }

    // get robots
    const robots = await prisma.robot.findMany({
        where: {
            team_id: teamID
        },
        orderBy: {
            created_at: 'desc'
        }
    });

    const response = robots.map(robot => ({
        id: robot.id,
        created_at: robot.created_at,
        updated_at: robot.updated_at
    }));

    return res.status(200).json(response);

});


/**
 * Get detailed info about a robot in a team.
 */
router.get('/robots/:robot_id', async (req: Request, res: Response) => {

    const teamID = req.headers['air-team-id']!;
    const robot_id = req.params.robot_id;

    // get robot
    const robot = await prisma.robot.findUnique({
        where: {
            team_id_id: {
                team_id: teamID,
                id: robot_id
            }
        },
        include: {
            ecus: {
                orderBy: {
                    created_at: 'desc'
                }
            },
            robot_manifests: {
                take: 10,
                orderBy: {
                    created_at: 'desc'
                }
            }
        }
    });

    if (!robot) {
        logger.warn('could not get info about robot because it or the team does not exist');
        return res.status(400).send('could not get robot');
    }

    const response = {
        id: robot.id,
        created_at: robot.created_at,
        updated_at: robot.updated_at,
        robot_manifests: robot.robot_manifests.map(manifest => ({
            id: manifest.id,
            created_at: manifest.created_at
        })),
        ecus: robot.ecus.map(ecu => ({
            id: ecu.id,
            created_at: ecu.created_at,
            updated_at: ecu.updated_at,
        }))
    };

    return res.status(200).json(response);

});


/**
 * Delete a robot
 * 
 * TODO
 * - delete all associated ecu keys
 */
router.delete('robots/:robot_id', async (req: Request, res: Response) => {

    const teamID = req.headers['air-team-id']!;
    const robot_id = req.params.robot_id;

    // try delete robot
    try {

        await prisma.robot.delete({
            where: {
                team_id_id: {
                    team_id: teamID,
                    id: robot_id
                }
            }
        });

        logger.info('deleted a robot');
        return res.status(200).send('deleted robot');

    } catch (error) {
        // catch deletion failure error code
        // someone has tried to create a robot that does not exist in this team, return 400
        if (error.code === 'P2025') {
            logger.warn('could not delete a robot because it does not exist');
            return res.status(400).send('could not delete robot');
        }
        // otherwise we dont know what happened so re-throw the errror and let the
        // general error catcher return it as a 500
        throw error;
    }

});


/**
 * List provisioning credentials in a team.
 */
router.get('/provisioning-credentials', async (req: Request, res: Response) => {

    const teamID = req.headers['air-team-id']!;

    // check team exists
    const teamCount = await prisma.team.count({
        where: {
            id: teamID
        }
    });

    if (teamCount === 0) {
        logger.warn('could not list images because team does not exist');
        return res.status(400).send('could not list images');
    }

    const provisioningCredentials = await prisma.provisioningCredentials.findMany({
        where: {
            team_id: teamID
        },
        orderBy: {
            created_at: 'desc'
        }
    });

    const response = provisioningCredentials.map(cred => ({
        id: cred.id,
        created_at: cred.created_at
    }));

    return res.status(200).json(response);

});



export default router;
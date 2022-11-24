import express from 'express';
import { keyStorage, loadKeyPair } from '../../core/key-storage';
import config from '../../config';
import { logger } from '../../core/logger';
import { generateKeyPair } from '../../core/crypto';
import { verifySignature } from '../../core/crypto/signatures';
import prisma from '../../core/postgres';
import { TUFRepo, TUFRole, Image } from '@prisma/client';
import { robotManifestSchema } from './schemas';
import { IKeyPair, IRobotManifest, ITargetsImages } from '../../types';
import { toCanonical } from '../../core/utils';
import { generateSnapshot, generateTargets, generateTimestamp, getLatestMetadataVersion } from '../../core/tuf';
import { ManifestErrors } from '../../core/consts/errors';

const router = express.Router();


/**
 * checks:
 * - robot exists
 * - all ecu public key can be loaded
 * - valid schema
 * - primary ecus version report is included
 * - all ecu reports are inluded
 * - no unknown ecu reports are included
 * - top level signature is signed by primary ecu private key
 * - each ecu report signature is signed by corresponding ecu private key
 * - each nonce in the ecu report has never been sent before
 * - no ecu reports have expired
 * - no ecu reports have any reported attacks
 * - probably a few more in time..
 * 
 */
export const robotManifestChecks = async (robotManifest: IRobotManifest, namespaceID: string, ecuSerials: string[]) => {

    //Do the async stuff needed for the checks functions here
    const robot = await prisma.robot.findUnique({
        where: {
            namespace_id_id: {
                namespace_id: namespaceID,
                id: robotManifest.signed.vin
            }
        },
        include: {
            ecus: true,
            robot_manifests: true
        }
    });

    if (!robot) throw (ManifestErrors.RobotNotFound);

    //Load all the pub keys that are included in the ecu version reports. This should include the primary ecu
    const ecuPubKeys: { [ecu_serial: string]: string } = {};

    try {

        for (const ecuSerial of ecuSerials) {
            ecuPubKeys[ecuSerial] = await keyStorage.getKey(`${namespaceID}-${ecuSerial}-public.pem`);
        }

    } catch (e) {
        throw (ManifestErrors.KeyNotLoaded)
    }

    const checks = {

        validateSchema: () => {
            const { error } = robotManifestSchema.validate(robotManifest);
            if (error) throw (ManifestErrors.InvalidSchema);
            return checks;
        },

        validatePrimaryECUReport: () => {
            if (robotManifest.signed.ecu_version_reports[robotManifest.signed.primary_ecu_serial] === undefined) {
                throw (ManifestErrors.MissingPrimaryReport);
            }
            return checks;
        },

        validateEcuRegistration: () => {

            const ecusSerialsRegistered: string[] = robot.ecus.map(ecu => (ecu.id));

            if (ecuSerials.length !== ecusSerialsRegistered.length) {
                throw (ManifestErrors.MissingECUReport)
            }

            for (const ecuSerial of ecuSerials) {
                if (!ecusSerialsRegistered.includes(ecuSerial)) {
                    throw (ManifestErrors.UnknownECUReport);
                }
            }

            return checks;
        },

        validateTopSignature: () => {

            const verified = verifySignature({
                signature: robotManifest.signatures[0].sig,
                pubKey: ecuPubKeys[robotManifest.signed.primary_ecu_serial],
                algorithm: 'RSA-SHA256',
                data: toCanonical(robotManifest.signed)
            });

            if (!verified) throw (ManifestErrors.InvalidSignature)

            return checks;

        },

        validateReportSignatures: () => {

            //NOTE: Its assumed each ecu version report is only signed by one key
            for (const ecuSerial of ecuSerials) {
                const verified = verifySignature({
                    signature: robotManifest.signed.ecu_version_reports[ecuSerial].signatures[0].sig,
                    pubKey: ecuPubKeys[ecuSerial],
                    algorithm: 'RSA-SHA256',
                    data: toCanonical(robotManifest.signed)
                });

                if (!verified) throw (ManifestErrors.InvalidReportSignature)
            }

            return checks;
        },

        validateNonces: () => {
            //For each ecu version report, check if the nonce for that report has ever been 
            //sent to us before in a previous manifest
            for (const ecuSerial of ecuSerials) {

                const previouslySentNonces: string[] = [];

                for (const manifest of robot.robot_manifests) {
                    //TODO fix typing
                    const fullManifest = manifest.value as any;
                    previouslySentNonces.push(fullManifest['signed']['ecu_version_reports'][ecuSerial]['signed']['nonce']);
                }

                if (previouslySentNonces.includes(robotManifest.signed.ecu_version_reports[ecuSerial].signed.nonce)) {
                    console.log(previouslySentNonces);
                    console.log(robotManifest.signed.ecu_version_reports[ecuSerial].signed.nonce);

                    throw (ManifestErrors.InvalidReportNonce)
                }
            }

            return checks;
        },

        validateTime: () => {

            const now = Math.floor(new Date().getTime() / 1000); //Assume this time is trusted for now

            for (const ecuSerial of ecuSerials) {

                const validForSecs: number = (ecuSerial === robotManifest.signed.primary_ecu_serial) ?
                    Number(config.PRIMARY_ECU_VALID_FOR_SECS) : Number(config.SECONDARY_ECU_VALID_FOR_SECS);


                if (robotManifest.signed.ecu_version_reports[ecuSerial].signed.time < (now - validForSecs)) {
                    throw (ManifestErrors.ExpiredReport)
                }
            }

            return checks;
        },

        validateAttacks: () => {

            for (const ecuSerial of ecuSerials) {
                console.log(robotManifest.signed.ecu_version_reports[ecuSerial].signed.attacks_detected);

                if (robotManifest.signed.ecu_version_reports[ecuSerial].signed.attacks_detected !== '') {
                    throw (ManifestErrors.AttackIdentified)
                }
            }

            return checks;
        }
    }

    return checks;

}


/**
 * For now we have a tmp table that simply maps ecu serials and images to make it easier
 * to test a full uptane runthrough. We will figure out how to do all the joining between rollouts,
 * stacks, versions, ecus etc. in due course when the schema becomes clearer.
 * 
 * For each ECU determine if the reported installed image is different to the latest one 
 * we have on record, if it is, we need to generate new tuf metadata for the ecu. Otherwise
 * we can infer that the ECU is running the latest avaiable image
 * 
 * NOTE: THIS WILL BE REPLACED VERY SOON
 */
const determineUpdateRequired = async (robotManifest: IRobotManifest, ecuSerials: string[]): Promise<boolean> => {


    //get all the 'rollouts' for each ecu reported
    const rolloutsPerEcu = await prisma.tmpEcuImages.findMany({
        distinct: ['ecu_id'],
        where: {
            ecu_id: {
                in: ecuSerials
            }
        },
        orderBy: {
            created_at: 'desc'
        },
        include: {
            image: true
        }
    })

    for (const ecuSerial of ecuSerials) {

        //Which (if any) of the ecus latest rollouts is this?
        const idx = rolloutsPerEcu.findIndex(elem => elem.ecu_id === ecuSerial);

        /*
        The robot has reported an ecu with an installed image that is not associated
        to any rollouts yet.This likely happens when the robot has it's factory image 
        installed and has never been instructed to perform an update to any of its ecus
        */
        if (idx == -1) {
            logger.info('ECU image is not in rollout')
        }
        else {
            //The robot is reporting about an ecu that is associated with a rollout
            //lets check if the image in the rollout is the different to the one being reported
            if (rolloutsPerEcu[idx].image.sha256 !==
                robotManifest.signed.ecu_version_reports[ecuSerial].signed.installed_image.hashes.sha256) {
                //there is a mismatch between rollout image and reported image, so an
                //upate to metadata is required
                return true;
            }
        }
    }
    return false;
}


/**
 * 
 * This can definitely be optimised but will do while we focus on readability 
 * rather than effiency. This is called after detecting if any of the ecus reported
 * by a robot differ to what is defined in the tmp rollouts table (TmpEcuImages).
 * We will generate the entite targets json from scratch and not try to compute which
 * of the ecus 1 - N ecus are different
 * 
 */
const generateNewMetadata = async (namespace_id: string, robot_id: string, ecuSerials: string[]) => {

    //we're repeating ourselves.... will be refactored later
    const rolloutsPerEcu = await prisma.tmpEcuImages.findMany({
        distinct: ['ecu_id'],
        where: {
            ecu_id: {
                in: ecuSerials
            }
        },
        orderBy: {
            created_at: 'desc'
        },
        include: {
            image: true
        }
    });


    // Lets generate the whole metadata file again
    const targetsImages: ITargetsImages = {}

    for (const ecuRollout of rolloutsPerEcu) {

        targetsImages[ecuRollout.ecu_id] = {
            custom: {
                ecu_serial: ecuRollout.ecu_id
            },
            length: ecuRollout.image.size,
            hashes: {
                sha256: ecuRollout.image.sha256,
                sha512: ecuRollout.image.sha512,
            }
        }
    }

    //determine new metadata versions
    const newTargetsVersion = await getLatestMetadataVersion(namespace_id, TUFRepo.director, TUFRole.targets, robot_id) + 1;
    const newSnapshotVersion = await getLatestMetadataVersion(namespace_id, TUFRepo.director, TUFRole.snapshot, robot_id) + 1;
    const newTimestampVersion = await getLatestMetadataVersion(namespace_id, TUFRepo.director, TUFRole.timestamp, robot_id) + 1;

    //Read the keys for the director
    const targetsKeyPair = await loadKeyPair(namespace_id, TUFRepo.director, TUFRole.targets);
    const snapshotKeyPair = await loadKeyPair(namespace_id, TUFRepo.director, TUFRole.snapshot);
    const timestampKeyPair = await loadKeyPair(namespace_id, TUFRepo.director, TUFRole.timestamp);

    //Generate the new metadata
    const targetsMetadata = generateTargets(config.TUF_TTL.IMAGE.TARGETS, newTargetsVersion, targetsKeyPair, targetsImages);
    const snapshotMetadata = generateSnapshot(config.TUF_TTL.IMAGE.SNAPSHOT, newSnapshotVersion, snapshotKeyPair, targetsMetadata.signed.version);
    const timestampMetadata = generateTimestamp(config.TUF_TTL.IMAGE.TIMESTAMP, newTimestampVersion, timestampKeyPair, snapshotMetadata.signed.version);

    // perform db writes in transaction
    await prisma.$transaction(async tx => {

        // create tuf metadata
        // prisma wants to be passed an `object` instead of our custom interface so we cast it
        await tx.metadata.create({
            data: {
                namespace_id,
                repo: TUFRepo.director,
                role: TUFRole.targets,
                robot_id: robot_id,
                version: newTargetsVersion,
                value: targetsMetadata as object,
                expires_at: targetsMetadata.signed.expires
            }
        });

        await tx.metadata.create({
            data: {
                namespace_id,
                repo: TUFRepo.director,
                role: TUFRole.snapshot,
                robot_id: robot_id,
                version: newSnapshotVersion,
                value: snapshotMetadata as object,
                expires_at: snapshotMetadata.signed.expires
            }
        });

        await tx.metadata.create({
            data: {
                namespace_id,
                repo: TUFRepo.director,
                role: TUFRole.timestamp,
                robot_id: robot_id,
                version: newTimestampVersion,
                value: timestampMetadata as object,
                expires_at: timestampMetadata.signed.expires
            }
        });

    })
}



router.post('/:namespace/robots/:robot_id/manifests', async (req, res) => {

    const namespace_id: string = req.params.namespace;
    const robot_id: string = req.params.robot_id;
    const manifest: IRobotManifest = req.body;

    let valid = true;

    // check namespace exists
    const namespaceCount = await prisma.namespace.count({
        where: {
            id: namespace_id
        }
    });

    if (namespaceCount === 0) {
        logger.warn('could not process manifest because namespace does not exist');
        return res.status(400).send('could not process manifest');
    }

    //We are gonna need these so many times so pull them out once
    const ecuSerials = Object.keys(manifest.signed.ecu_version_reports);

    try {

        // Perform all of the checks
        (await robotManifestChecks(manifest, namespace_id, ecuSerials))
            .validatePrimaryECUReport()
            .validateSchema()
            .validateEcuRegistration()
            .validateTopSignature()
            .validateReportSignatures()
            .validateNonces()
            .validateTime()
            .validateAttacks()

        /**
         * if we get to this point we believe we have a manifest that is in good order
         * now we can inspect the images that were reported and decide what to do.
         * in airbotics, images are deployed to robots through rollouts so we consult that table.
         * if the robot is up-to-date then no new tuf metadata needs to be created, so we gracefully
         * exit and thank the primary for its time. Otherwise we need to generate new TUF targets, 
         * snapshot and timestamp files for each ecu that needs updated.
         */

        const updateRequired = await determineUpdateRequired(manifest, ecuSerials);

        if (!updateRequired) {
            logger.info('processed manifest for robot and determined all ecus have already installed their latest images');
        }

        else {
            await generateNewMetadata(namespace_id, robot_id, ecuSerials);
            logger.info('processed manifest for robot and created new tuf metadata');
        }

        // phew we made it
        return res.status(200).end();


    }
    catch (e) {
        valid = false;
        logger.error('Unable to accept robot manifest');
        logger.error(e);
        return res.status(400).send(e)
    }
    finally {

        //Regardless of what happened above, lets save the sent manifest
        await prisma.robotManifest.create({
            data: {
                namespace_id: namespace_id,
                robot_id: robot_id,
                value: manifest as object,
                valid: valid
            }
        })

    }

});



/**
 * Create a robot in a namespace.
 * 
 * Creates a robot and one primary ecu for it, also creates a key pair for it,
 * we dont store the private key here but we store its public key in the key server
 * the response contains the bootstrapping credentials the primary requires to
 * provision itself with us
 */
router.post('/:namespace/robots', async (req, res) => {

    const namespace_id = req.params.namespace;

    // check namespace exists
    const namespaceCount = await prisma.namespace.count({
        where: {
            id: namespace_id
        }
    });

    if (namespaceCount === 0) {
        logger.warn('could not create robot because namespace does not exist');
        return res.status(400).send('could not create robot');
    }

    // create the robot in the inventory db
    const robot = await prisma.robot.create({
        data: {
            namespace_id,
            ecus: {
                create: {
                    primary: true
                }
            }
        },
        include: {
            ecus: true
        }
    });

    // create key pair
    const primaryEcuKey = generateKeyPair(config.KEY_TYPE);

    // store the public key in the keyserver
    await keyStorage.putKey(`${robot.id}-public`, primaryEcuKey.publicKey);

    // return the credentials the primary ecu will use to provision itself
    // in the format expected by the client
    // we know the robot only has one ecu now so can safely index its array of ecus
    const response: any = {
        vin: robot.id,
        primary_ecu_serial: robot.ecus[0].id,
        public_key: primaryEcuKey.publicKey,
        namespace_id
    };

    logger.info('created a robot');
    return res.status(200).json(response);

});


/**
 * List robots in a namespace.
 */
router.get('/:namespace/robots', async (req, res) => {

    const namespace_id = req.params.namespace;

    // check namespace exists
    const namespaceCount = await prisma.namespace.count({
        where: {
            id: namespace_id
        }
    });

    if (namespaceCount === 0) {
        logger.warn('could not list robots because namespace does not exist');
        return res.status(400).send('could not list robots');
    }

    // get robots
    const robots = await prisma.robot.findMany({
        where: {
            namespace_id
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
 * Get detailed info about a robot in a namespace.
 */
router.get('/:namespace/robots/:robot_id', async (req, res) => {

    const namespace_id = req.params.namespace;
    const robot_id = req.params.robot_id;

    // get robot
    const robot = await prisma.robot.findUnique({
        where: {
            namespace_id_id: {
                namespace_id,
                id: robot_id
            }
        },
        include: {
            ecus: true,
            robot_manifests: true
        }
    });

    if (!robot) {
        logger.warn('could not get info about robot because it or the namespace does not exist');
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
 */
router.delete('/:namespace/robots/:robot_id', async (req, res) => {

    const namespace_id = req.params.namespace;
    const robot_id = req.params.robot_id;

    // try delete robot
    try {

        await prisma.robot.delete({
            where: {
                namespace_id_id: {
                    namespace_id,
                    id: robot_id
                }
            }
        });

        logger.info('deleted a robot');
        return res.status(200).send('deleted robot');

    } catch (error) {
        // catch deletion failure error code
        // someone has tried to create a robot that does not exist in this namespace, return 400
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
 * Create a rollout.
 * 
 * Creates an association betwen an ecu and image.
 */
router.post('/:namespace/rollouts', async (req, res) => {

    const {
        ecu_id,
        image_id
    } = req.body;


    const namespace_id = req.params.namespace;

    // check namespace exists
    const namespaceCount = await prisma.namespace.count({
        where: {
            id: namespace_id
        }
    });

    if (namespaceCount === 0) {
        logger.warn('could not create a rollout because namespace does not exist');
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
 * Fetch role metadata (apart from timestamp) in a namespace.
 * 
 * Timestamp is not handled with this route because it isn't prepended
 * with a dot, i.e. `/timestamp.json` instead not `/1.timestamp.json`
 */
router.get('/:namespace/:version.:role.json', async (req, res) => {

    const namespace_id = req.params.namespace;
    const version = Number(req.params.version);
    const role = req.params.role;

    const metadata = await prisma.metadata.findUnique({
        where: {
            namespace_id_repo_role_version: {
                namespace_id,
                repo: TUFRepo.director,
                role: role as TUFRole,
                version
            }
        }
    });

    if (!metadata) {
        logger.warn(`could not download ${role} metadata because it does not exist`);
        return res.status(404).end();
    }

    // check it hasnt expired
    // TODO    

    return res.status(200).send(metadata.value);

});


/**
 * Fetch timestamp metadata in a namespace.
 */
router.get('/:namespace/timestamp.json', async (req, res) => {

    const namespace_id = req.params.namespace;

    // get the most recent timestamp
    const timestamps = await prisma.metadata.findMany({
        where: {
            namespace_id,
            repo: TUFRepo.director,
            role: TUFRole.timestamp
        },
        orderBy: {
            created_at: 'desc'
        }
    });

    if (timestamps.length === 0) {
        logger.warn('could not download timestamp metadata because it does not exist');
        return res.status(404).end();
    }

    const mostRecentTimestamp = timestamps[0];

    // check it hasnt expired
    // TODO    

    return res.status(200).send(mostRecentTimestamp.value);

});


export default router;
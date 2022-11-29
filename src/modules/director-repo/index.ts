import express from 'express';
import fs from 'fs';
import { TUFRepo, TUFRole, Image, Prisma } from '@prisma/client';
import { keyStorage, loadKeyPair } from '../../core/key-storage';
import config from '../../config';
import { logger } from '../../core/logger';
import { verifySignature } from '../../core/crypto/signatures';
import prisma from '../../core/postgres';
import { robotManifestSchema } from './schemas';
import { IRobotManifest, ITargetsImages, IEcuRegistrationPayload } from '../../types';
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
export const robotManifestChecks = async (robotManifest: IRobotManifest, namespaceID: string, robotId: string, ecuSerials: string[]) => {

    //Do the async stuff needed for the checks functions here
    const robot = await prisma.robot.findUnique({
        where: {
            namespace_id_id: {
                namespace_id: namespaceID,
                id: robotId
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
            ecuPubKeys[ecuSerial] = await keyStorage.getKey(`${namespaceID}-${ecuSerial}-public`);
        }

    } catch (e) {
        throw (ManifestErrors.KeyNotLoaded);
    }

    const checks = {

        validateSchema: () => {
            const { error } = robotManifestSchema.validate(robotManifest);

            if (error) throw (ManifestErrors.InvalidSchema);

            return checks;
        },

        validatePrimaryECUReport: () => {
            if (robotManifest.signed.ecu_version_manifests[robotManifest.signed.primary_ecu_serial] === undefined) {
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

            const verified: boolean = verifySignature({
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
                    signature: robotManifest.signed.ecu_version_manifests[ecuSerial].signatures[0].sig,
                    pubKey: ecuPubKeys[ecuSerial],
                    algorithm: 'RSA-SHA256',
                    data: toCanonical(robotManifest.signed.ecu_version_manifests[ecuSerial].signed)
                });

                if (!verified) throw (ManifestErrors.InvalidReportSignature);

            }

            return checks;
        },

        // TODO rename this to report counter
        validateNonces: () => {
            //For each ecu version report, check if the nonce for that report has ever been 
            //sent to us before in a previous manifest
            for (const ecuSerial of ecuSerials) {

                const previouslySentNonces: number[] = [];

                for (const manifest of robot.robot_manifests) {
                    //TODO fix typing
                    const fullManifest = manifest.value as any;
                    previouslySentNonces.push(fullManifest['signed']['ecu_version_manifests'][ecuSerial]['signed']['report_counter']);
                }

                if (previouslySentNonces.includes(robotManifest.signed.ecu_version_manifests[ecuSerial].signed.report_counter)) {
                    throw (ManifestErrors.InvalidReportNonce)
                }
            }

            return checks;
        },

        /*
        validateTime: () => {

            const now = Math.floor(new Date().getTime() / 1000); //Assume this time is trusted for now

            for (const ecuSerial of ecuSerials) {

                const validForSecs: number = (ecuSerial === robotManifest.signed.primary_ecu_serial) ?
                    Number(config.PRIMARY_ECU_VALID_FOR_SECS) : Number(config.SECONDARY_ECU_VALID_FOR_SECS);


                if (robotManifest.signed.ecu_version_manifests[ecuSerial].signed.time < (now - validForSecs)) {
                    throw (ManifestErrors.ExpiredReport)
                }
            }

            return checks;
        },
        */

        validateAttacks: () => {

            for (const ecuSerial of ecuSerials) {

                if (robotManifest.signed.ecu_version_manifests[ecuSerial].signed.attacks_detected !== '') {
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
 * we can infer that the ECU is running the latest avaiable image. There is also a check to 
 * see if the latest rollout has been acknowledged so we don't generate new metadata more than once.
 * 
 * NOTE: THIS WILL BE REPLACED VERY SOON
 */
const determineNewMetadaRequired = async (robotManifest: IRobotManifest, ecuSerials: string[]): Promise<boolean> => {


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

            /*
            The robot is reporting an ecu that is associated with a rollout
            Lets first check if the rollout has been acknowledged, If it has, we have 
            already generated the corresponding metadata files, so we dont have to do anything
            */
            if (rolloutsPerEcu[idx].acknowledged) {
                logger.info('Metadata has already been generated for this ECUs image')
            }

            else {
                if (rolloutsPerEcu[idx].image.sha256 !==
                    robotManifest.signed.ecu_version_manifests[ecuSerial].signed.installed_image.fileinfo.hashes.sha256) {

                    //there is a mismatch between rollout image and reported image, so we must generate new metadata
                    return true;
                }
            }
        }
    }
    return false;
}


/**
 * This can definitely be optimised but will do while we focus on readability 
 * rather than effiency. This is called after detecting if any of the ecus reported
 * by a robot differ to what is defined in the tmp rollouts table (TmpEcuImages).
 * We will generate the entite targets json from scratch and not try to compute which
 * of the ecus 1 - N ecus are different
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

        //Update the acknowledged field in the rollouts table
        await prisma.tmpEcuImages.updateMany({
            where: {
                ecu_id: {
                    in: ecuSerials
                }
            },
            data: {
                acknowledged: true
            }
        })

    })
}


/**
 * Process a manifest from a robot
 */
router.put('/:namespace/robots/:robot_id/manifest', async (req, res) => {

    const namespace_id: string = req.params.namespace;
    const robot_id = req.params.robot_id;
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
    // BUG this assumes the manifest is formatted correctly before we valid its schema
    const ecuSerials = Object.keys(manifest.signed.ecu_version_manifests);

    try {

        // Perform all of the checks
        (await robotManifestChecks(manifest, namespace_id, robot_id, ecuSerials))
            .validatePrimaryECUReport()
            .validateSchema()
            .validateEcuRegistration()
            .validateTopSignature()
            .validateReportSignatures()
            .validateNonces()
            // .validateTime()
            .validateAttacks()

        /**
         * if we get to this point we believe we have a manifest that is in good order
         * now we can inspect the images that were reported and decide what to do.
         * in airbotics, images are deployed to robots through rollouts so we consult that table.
         * if the robot is up-to-date then no new tuf metadata needs to be created, so we gracefully
         * exit and thank the primary for its time. Otherwise we need to generate new TUF targets, 
         * snapshot and timestamp files for each ecu that needs updated.
         */

        const updateRequired = await determineNewMetadaRequired(manifest, ecuSerials);

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
        logger.error('unable to accept robot manifest');
        // console.log(e)
        logger.error(e);
        return res.status(400).send('unable to accept robot manifest');
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
        });

    }

});



/**
 * Ingest network info reported by a robot
 * 
 * BUG
 */
router.put('/:namespace/robots/:robot_id/system_info/network', async (req, res) => {

    const namespace_id = req.params.namespace;
    const robot_id = req.params.robot_id;

    const {
        hostname,
        local_ipv4,
        mac
    } = req.body;


    // check namespace exists
    const namespaceCount = await prisma.namespace.count({
        where: {
            id: namespace_id
        }
    });

    if (namespaceCount === 0) {
        logger.warn('could not create network report because namespace does not exist');
        return res.status(400).send('could not create network report');
    }

    // check robot exists
    const robotCount = await prisma.robot.count({
        where: {
            id: robot_id
        }
    });

    if (robotCount === 0) {
        logger.warn('could not create network report because robot does not exist');
        return res.status(400).send('could not create network report');
    }


    await prisma.networkReport.create({
        data: {
            namespace_id,
            robot_id,
            hostname,
            local_ipv4,
            mac
        }
    });

    logger.info('ingested robot network info');
    return res.status(200).end();
});



/**
 * A robot is provisioning itself using the provisioning credentials.
 * 
 * Create the robot in the db.
 * Generate a p12 and send it back.
 * 
 * TODO:
 * - handle ttl
 * - return error if robot is already registered
 */
router.post('/:namespace/devices', async (req, res) => {

    const namespace_id = req.params.namespace;

    const {
        deviceId,
        ttl
    } = req.body;

    // check namespace exists
    const namespaceCount = await prisma.namespace.count({
        where: {
            id: namespace_id
        }
    });

    if (namespaceCount === 0) {
        logger.warn('could not provision robot because namespace does not exist');
        return res.status(400).send('could not provision robot');
    }

    await prisma.robot.create({
        data: {
            namespace_id,
            id: deviceId
        }
    });

    logger.info('provisioned a robot');

    // TODO we'll stream back a temporary p12 file, but we'll want to create one specific to this robot
    const fileStream = fs.createReadStream('./res/temp.p12');
    fileStream.pipe(res);

});



/**
 * A robot is registering an ecu
 * 
 * TODO
 * - return error if ecu is already registered
 */
router.post('/:namespace/robots/:robot_id/ecus', async (req, res) => {

    const namespace_id = req.params.namespace;
    const robot_id = req.params.robot_id;
    const payload: IEcuRegistrationPayload = req.body;

    // check namespace exists
    const namespaceCount = await prisma.namespace.count({
        where: {
            id: namespace_id
        }
    });

    if (namespaceCount === 0) {
        logger.warn('could not register ecu because namespace does not exist');
        return res.status(400).send('could not register ecu');
    }


    // check robot exists
    const robotCount = await prisma.robot.count({
        where: {
            id: robot_id
        }
    });

    if (robotCount === 0) {
        logger.warn('could not register ecu because robot does not exist');
        return res.status(400).send('could not register ecu');
    }

    const createEcusData = payload.ecus.map(ecu => ({
        id: ecu.ecu_serial,
        namespace_id,
        robot_id,
        hwid: ecu.hardware_identifier,
        primary: ecu.ecu_serial === payload.primary_ecu_serial
    }));


    await prisma.$transaction(async tx => {

        for (const ecu of payload.ecus) {
            await keyStorage.putKey(`${namespace_id}-${ecu.ecu_serial}-public`, ecu.clientKey.keyval.public);
        }

        await tx.ecu.createMany({
            data: createEcusData
        });

    });

    logger.info('registered an ecu');

    res.status(200).end();
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
 * 
 * TODO
 * - limit number of manifests returned
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
 * 
 * TODO
 * - delete all associated ecu keys
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
 * Fetch role metadata (apart from timestamp) in a namespace.
 * 
 * Timestamp is not handled with this route because it isn't prepended
 * with a dot, i.e. `/timestamp.json` instead not `/1.timestamp.json`
 * 
 * TODO
 * - fetch only the metadata for this robot
 */
router.get('/:namespace/robots/:robot_id/:version.:role.json', async (req, res) => {

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
 * 
 * TODO
 * - fetch only the metadata for this robot
 */
router.get('/:namespace/robots/:robot_id/timestamp.json', async (req, res) => {

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

    const mostRecentTimestamp = timestamps[0].value as Prisma.JsonObject;
    // check it hasnt expired
    // TODO    
    return res.status(200).send(mostRecentTimestamp);

});


export default router;
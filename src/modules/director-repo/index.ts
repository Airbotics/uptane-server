import express, { Request } from 'express';
import { TUFRepo, TUFRole, Prisma } from '@prisma/client';
import { keyStorage, loadKeyPair } from '@airbotics-core/key-storage';
import config from '@airbotics-config';
import { logger } from '@airbotics-core/logger';
import { verifySignature } from '@airbotics-core/crypto';
import prisma from '@airbotics-core/postgres';
import { robotManifestSchema } from './schemas';
import { IRobotManifest, ITargetsImages, IEcuRegistrationPayload } from '@airbotics-types';
import { toCanonical } from '@airbotics-core/utils';
import { generateSnapshot, generateTargets, generateTimestamp, getLatestMetadataVersion } from '@airbotics-core/tuf';
import { ManifestErrors } from '@airbotics-core/consts/errors';
import { ensureRobotAndNamespace } from '@airbotics-middlewares';


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
 * - each report counter in the ecu report has never been sent before
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

            if (error) {
                throw (ManifestErrors.InvalidSchema);
            }

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

            // Note: should we attempt to verify signature from a manifest if it different to the configured signature scheme
            const verified = verifySignature(toCanonical(robotManifest.signed), robotManifest.signatures[0].sig, ecuPubKeys[robotManifest.signed.primary_ecu_serial], { signatureScheme: config.TUF_SIGNATURE_SCHEME });

            if (!verified) throw (ManifestErrors.InvalidSignature)

            return checks;

        },

        validateReportSignatures: () => {

            // NOTE: Its assumed each ecu version report is only signed by one key
            for (const ecuSerial of ecuSerials) {

                const verified = verifySignature(toCanonical(robotManifest.signed.ecu_version_manifests[ecuSerial].signed), robotManifest.signed.ecu_version_manifests[ecuSerial].signatures[0].sig, ecuPubKeys[robotManifest.signed.primary_ecu_serial], { signatureScheme: config.TUF_SIGNATURE_SCHEME });

                if (!verified) {
                    console.log('breakding')
                    throw (ManifestErrors.InvalidReportSignature);
                }

            }

            return checks;
        },

        validateReportCounter: () => {
            // For each ecu version report, check if the report counter for that report has ever been 
            // sent to us before in a previous manifest
            for (const ecuSerial of ecuSerials) {

                const previouslySentReportCounter: number[] = [];

                for (const manifest of robot.robot_manifests) {
                    // TODO fix typing
                    const fullManifest = manifest.value as any;
                    previouslySentReportCounter.push(fullManifest['signed']['ecu_version_manifests'][ecuSerial]['signed']['report_counter']);
                }

                if (previouslySentReportCounter.includes(robotManifest.signed.ecu_version_manifests[ecuSerial].signed.report_counter)) {
                    throw (ManifestErrors.InvalidReportCounter)
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
const determineNewMetadataRequired = async (robotManifest: IRobotManifest, ecuSerials: string[]): Promise<boolean> => {


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
            logger.warn('ECU image is not in rollout');
        } else {

            /*
            The robot is reporting an ecu that is associated with a rollout
            Lets first check if the rollout has been acknowledged, If it has, we have 
            already generated the corresponding metadata files, so we dont have to do anything
            */
            if (rolloutsPerEcu[idx].acknowledged) {
                logger.info('Metadata has already been generated for this ECUs image')
            } else {

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
            image: true,
            ecu: true
        }
    });


    // Lets generate the whole metadata file again
    const targetsImages: ITargetsImages = {};

    for (const ecuRollout of rolloutsPerEcu) {

        targetsImages[ecuRollout.image_id] = {
            custom: {
                ecuIdentifiers: {
                    [ecuRollout.ecu_id]: {
                        hardwareId: ecuRollout.ecu.hwid
                    }
                },
                targetFormat: String(ecuRollout.image.format).toUpperCase(),
                uri: `${config.ROBOT_GATEWAY_ORIGIN}/api/v0/robot/repo/images/${ecuRollout.image_id}`
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
    const snapshotMetadata = generateSnapshot(config.TUF_TTL.IMAGE.SNAPSHOT, newSnapshotVersion, snapshotKeyPair, targetsMetadata);
    const timestampMetadata = generateTimestamp(config.TUF_TTL.IMAGE.TIMESTAMP, newTimestampVersion, timestampKeyPair, snapshotMetadata);

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
router.put('/manifest', ensureRobotAndNamespace, async (req: Request, res) => {

    const manifest: IRobotManifest = req.body;

    const {
        namespace_id,
        robot_id
    } = req.robotGatewayPayload!;

    let valid = true;

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
            .validateReportCounter()
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

        const updateRequired = await determineNewMetadataRequired(manifest, ecuSerials);

        if (!updateRequired) {
            logger.info('processed manifest for robot and determined all ecus have already installed their latest images');
        } else {
            await generateNewMetadata(namespace_id, robot_id, ecuSerials);
            logger.info('processed manifest for robot and created new tuf metadata');
        }

        // phew we made it
        return res.status(200).end();


    }
    catch (e) {
        valid = false;
        logger.error('unable to accept robot manifest');
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
 * A robot is registering an ecu
 * 
 * TODO
 * - return error if ecu is already registered
 */
router.post('/ecus', ensureRobotAndNamespace, async (req: Request, res) => {

    const payload: IEcuRegistrationPayload = req.body;

    const {
        namespace_id,
        robot_id
    } = req.robotGatewayPayload!;

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
 * Fetch versioned role metadata in a namespace.
 */
router.get('/:version.:role.json', ensureRobotAndNamespace, async (req: Request, res) => {

    const version = Number(req.params.version);
    const role = req.params.role;

    const {
        namespace_id,
        robot_id
    } = req.robotGatewayPayload!;

    // since this is the director repo metadata is genereated per robot, apart from
    // the root which is the same for all. therefore if the role is root we don't
    // include the robot_id as a clause
    const metadata = await prisma.metadata.findFirst({
        where: {
            namespace_id,
            repo: TUFRepo.director,
            role: role as TUFRole,
            version,
            ...(role !== TUFRole.root && { robot_id })
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
 * Fetch latest metadata in a namespace.
 */
router.get('/:role.json', ensureRobotAndNamespace, async (req: Request, res) => {

    const role = req.params.role;


    const {
        namespace_id,
        robot_id
    } = req.robotGatewayPayload!;

    // since this is the director repo metadata is genereated per robot, apart from
    // the root which is the same for all. therefore if the role is root we don't
    // include the robot_id as a clause
    const metadata = await prisma.metadata.findMany({
        where: {
            namespace_id,
            repo: TUFRepo.director,
            role: req.params.role as TUFRole,
            ...(role !== TUFRole.root && { robot_id })
        },
        orderBy: {
            created_at: 'desc'
        }
    });

    if (metadata.length === 0) {
        logger.warn(`could not download ${role} metadata because it does not exist`);
        return res.status(404).end();
    }

    const mostRecentMetadata = metadata[0].value as Prisma.JsonObject;

    // check it hasnt expired
    // TODO

    return res.status(200).send(mostRecentMetadata);

});


export default router;
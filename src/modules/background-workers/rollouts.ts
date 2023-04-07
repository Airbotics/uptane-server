import { EcuStatus, Ecu, TUFRepo, TUFRole, Image, RolloutRobotStatus, RolloutStatus } from '@prisma/client';
import prisma from '@airbotics-core/drivers/postgres';
import config from '@airbotics-config';
import { logger } from '@airbotics-core/logger';
import { generateSignedSnapshot, generateSignedTargets, generateSignedTimestamp, getLatestMetadataVersion } from '@airbotics-core/tuf';
import { ITargetsImages } from '@airbotics-types';
import { keyStorage } from '@airbotics-core/key-storage';
import { getKeyStorageRepoKeyId } from '@airbotics-core/utils';



/**
 * Responsible for processing any pending robots associated with any ongoing rollouts. 
 * This will most likely be done in batches in due course.
 * The processing takes care of generating a new director targets.json for the robot if
 * it has any ecus on board that match a hardware id of an image in the rollout.
 * 
 * If it a robot has no ecus that have matching hwids, it will be skipped and no new director
 * targets.json will be generated.
 * 
 * 
 * Edge cases
 * 
 * 1) Robot belongs to >1 unprocessed rollouts
 *      Should we
 *          a) mark oldest n will be marked as 'skipped', and only the latest will be processed
 *          b) create a n new targets.jsons for each rollout and mark them as scheduled
 * 
 * 2) An image associated with a rollout has been deleted. In the images delete endpoint logic should be:
 *      
 *      It can be deleted if all associated RolloutRobot.status = 'successful' | 'cancelled' | 'failed'
 *      
 *      It cannot be deleted if any associated RolloutRobot.status =  'pending' | 'scheduled' | 'accepted'
 * 
 *      We can still check here if somehow this image has been deleted and fire a warning.
 *        
 * 
 * - 3) robot associated with a rollout has been deleted 
 *      set status to skipped
 * 
 * - 4) A rollout is cancelled
 * 
 * 
 */
const processPending = async (teamIds: string[]) => {

    for (const teamId of teamIds) {

        // check if any rollouts have a device in them that has yet to be processed
        const unprocessedRollouts = await prisma.rollout.findMany({
            where: {
                team_id: teamId,
                status: RolloutStatus.launched,
                robots: {
                    some: {
                        status: RolloutRobotStatus.pending
                    }
                }
            },
            orderBy: {
                created_at: 'asc'
            }
        });

        logger.debug(`${unprocessedRollouts.length} rollouts to process for team: ${teamId}`);

        for (const rollout of unprocessedRollouts) {

            // which robots from the rollout are still to be processed (should be doing them all in one go)
            const rolloutRobots = await prisma.rolloutRobot.findMany({
                where: {
                    rollout_id: rollout.id,
                    status: RolloutRobotStatus.pending
                },
                include: {
                    robot: {
                        include: {
                            ecus: true
                        }
                    }
                }
            });

            const rolloutImages = await prisma.rolloutHardwareImage.findMany({
                where: {
                    rollout_id: rollout.id
                },
                include: {
                    image: true
                }
            });

            for (const rolloutBot of rolloutRobots) {

                // robot has been deleted since rollout was created
                if (!rolloutBot.robot) {
                    await setRolloutRobotStatus(rolloutBot.id, RolloutRobotStatus.skipped);
                    continue;
                }

                const affectedEcus: { ecu: Ecu, image: Image }[] = [];

                // for each ecu in the robot, check if it has a hwid of an image in the rollout
                for (const botEcu of rolloutBot.robot.ecus) {

                    const rolloutImage = rolloutImages.find(img => img.hw_id === botEcu.hwid);

                    if (rolloutImage) {
                        
                        //This should never happen as images should not be deleted while a rolloutRobot.status = pending
                        if (!rolloutImage.image) {
                            logger.error(`image with hwid: ${rolloutImage.hw_id} may have been deleted `);
                            continue;
                        }

                        // The ECU doesnt already have this image installed
                        if(botEcu.image_id !== rolloutImage.image_id) {
                            affectedEcus.push({ ecu: botEcu, image: rolloutImage.image });
                        }
                    }
                }

                //robot is not affected by the rollout
                if (affectedEcus.length === 0) {
                    await setRolloutRobotStatus(rolloutBot.id, RolloutRobotStatus.skipped);
                }

                //we need to generate new director metadata for the bot (ie is affected by the rollout)
                else {
                    await generateNewMetadata(teamId, rolloutBot.robot_id!, rolloutBot.id, affectedEcus);
                    await setRolloutRobotStatus(rolloutBot.id, RolloutRobotStatus.scheduled);
                }
            }
        }
    }
}


/**
 * Responsible for processing the following status'
 * - RolloutRobot.status (overall robot status, aggregate of all RolloutRobotEcu.status)
 * - Rollout.status  (overall rollout status, aggregate of all RolloutRobot.status)
 * 
 * TODO: We need to determine which failure/error status' are terminal. Only the happy path
 * is accounted for in this logic. 
 * 
 */
const processStatuses = async (teamIds: string[]) => {

    for (const teamId of teamIds) {

        const ongoingRollouts = await prisma.rollout.findMany({
            where: {
                team_id: teamId,
                status: 'launched'
            },
            include: {
                robots: {
                    include: {
                        ecus: true
                    }
                }
            },
            orderBy: {
                created_at: 'asc'
            }
        })

        for (const rollout of ongoingRollouts) {

            //can overall rollout status be updated?
            if (rollout.robots.every(robot => (robot.status === RolloutRobotStatus.skipped || robot.status === RolloutRobotStatus.completed))) {
                await setRolloutStatus(rollout.id, RolloutStatus.completed);
                continue;
            }

            //can any of the RolloutRobot status be updated?
            for (const rolloutBot of rollout.robots) {
                const ecuStatus: (EcuStatus | null)[] = rolloutBot.ecus.map(ecu => ecu.status);
                switch (rolloutBot.status) {
                    case RolloutRobotStatus.scheduled:
                        //at least one of the ecus has started to update
                        if (!ecuStatus.includes(null)) {
                            await setRolloutRobotStatus(rolloutBot.id, RolloutRobotStatus.accepted);
                        }
                        break;
                    case RolloutRobotStatus.accepted: {
                        //all ecus have reported to be running the new image
                        if(ecuStatus.every(status => status === EcuStatus.installation_completed)) {
                            await setRolloutRobotStatus(rolloutBot.id, RolloutRobotStatus.completed);
                        }
                        //one or more ecus have reported to haved failed to install the new image
                        else if(ecuStatus.includes(EcuStatus.installation_failed)) {
                            await setRolloutRobotStatus(rolloutBot.id, RolloutRobotStatus.failed);
                        }
                        break;
                    }
                    case RolloutRobotStatus.pending: break;     //worker hasnt created director metadata yet
                    case RolloutRobotStatus.skipped: break;     //robot has no compatible ecus
                    case RolloutRobotStatus.completed: break;   //this worker already marked the status as complete
                    case RolloutRobotStatus.cancelled: break;   //user has cancelled the rollout
                    case RolloutRobotStatus.failed: break;      //this worker already marked the status as failed
                }
            }
        }
    }
}


/**
 * Helper to set the rolloutRobot status
 */
const setRolloutRobotStatus = async (id: string, status: RolloutRobotStatus) => {

    await prisma.rolloutRobot.update({
        where: {
            id: id
        },
        data: {
            status: status
        }
    });
}



/**
 * Helper to set the overall rollout status
 */
const setRolloutStatus = async (rollout_id: string, status: RolloutStatus) => {

    await prisma.rollout.update({
        where: {
            id: rollout_id
        },
        data: {
            status: status
        }
    })
}


/**
 * Helper to generate the new director targets.json for each affected robot
 * 
 * The custom field 'correlationId' represents the RobotRollout.id that is sent back
 * by aktualizr events. 
 */
const generateNewMetadata = async (team_id: string, robot_id: string, correlationId: string, affectedEcus: { ecu: Ecu, image: Image }[]) => {

    // Lets generate the whole metadata file again
    const targetsImages: ITargetsImages = {};

    //This is the rolloutRobot.id in our case, aktualizr will send this up with events and we can use it to update status'
    const custom = { correlationId: correlationId }

    for (const affected of affectedEcus) {

        targetsImages[affected.image.target_id] = {
            custom: {
                ecuIdentifiers: {
                    [affected.ecu.id]: {
                        hardwareId: affected.ecu.hwid
                    }
                },
                targetFormat: String(affected.image.format).toUpperCase(),
                uri: `${config.GATEWAY_ORIGIN}/api/v0/robot/repo/images/${affected.image.id}`
            },
            length: affected.image.size,
            hashes: {
                sha256: affected.image.sha256,
            }
        }
    }


    //determine new metadata versions
    const newTargetsVersion = await getLatestMetadataVersion(team_id, TUFRepo.director, TUFRole.targets, robot_id) + 1;
    const newSnapshotVersion = await getLatestMetadataVersion(team_id, TUFRepo.director, TUFRole.snapshot, robot_id) + 1;
    const newTimestampVersion = await getLatestMetadataVersion(team_id, TUFRepo.director, TUFRole.timestamp, robot_id) + 1;

    //Read the keys for the director
    const targetsKeyPair = await keyStorage.getKeyPair(getKeyStorageRepoKeyId(team_id, TUFRepo.director, TUFRole.targets));
    const snapshotKeyPair = await keyStorage.getKeyPair(getKeyStorageRepoKeyId(team_id, TUFRepo.director, TUFRole.snapshot));
    const timestampKeyPair = await keyStorage.getKeyPair(getKeyStorageRepoKeyId(team_id, TUFRepo.director, TUFRole.timestamp));

    //Generate the new metadata
    const targetsMetadata = generateSignedTargets(config.TUF_TTL.DIRECTOR.TARGETS, newTargetsVersion, targetsKeyPair, targetsImages, custom);
    const snapshotMetadata = generateSignedSnapshot(config.TUF_TTL.DIRECTOR.SNAPSHOT, newSnapshotVersion, snapshotKeyPair, targetsMetadata);
    const timestampMetadata = generateSignedTimestamp(config.TUF_TTL.DIRECTOR.TIMESTAMP, newTimestampVersion, timestampKeyPair, snapshotMetadata);

    // perform db writes in transaction
    await prisma.$transaction(async tx => {

        await tx.tufMetadata.create({
            data: {
                team_id,
                repo: TUFRepo.director,
                role: TUFRole.targets,
                robot_id: robot_id,
                version: newTargetsVersion,
                value: targetsMetadata as object,
                expires_at: targetsMetadata.signed.expires
            }
        });

        await tx.tufMetadata.create({
            data: {
                team_id,
                repo: TUFRepo.director,
                role: TUFRole.snapshot,
                robot_id: robot_id,
                version: newSnapshotVersion,
                value: snapshotMetadata as object,
                expires_at: snapshotMetadata.signed.expires
            }
        });

        await tx.tufMetadata.create({
            data: {
                team_id,
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



export const processRollouts = async () => {

    logger.info('rollouts processing started');

    try {

        const teamIds: string[] = (await prisma.team.findMany({
            select: { id: true }
        })).map(team => team.id);

        logger.debug(`${teamIds.length} teams to process rollouts`);

        await processPending(teamIds);
        await processStatuses(teamIds);

        logger.info('rollouts processing completed');
    }
    catch (e) {
        logger.error('rollouts processing failed');
        console.log(e);
    }
}
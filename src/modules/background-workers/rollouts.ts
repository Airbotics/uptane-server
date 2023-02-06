import { Ecu, TUFRepo, TUFRole, Image, RolloutRobotStatus } from '@prisma/client';
import prisma from '@airbotics-core/drivers/postgres';
import config from '@airbotics-config';
import { logger } from '@airbotics-core/logger';
import { generateSignedSnapshot, generateSignedTargets, generateSignedTimestamp, getLatestMetadataVersion } from '@airbotics-core/tuf';
import { ITargetsImages } from '@airbotics-types';
import { keyStorage } from '@airbotics-core/key-storage';
import { getKeyStorageRepoKeyId } from '@airbotics-core/utils';



/**
 * Responsible for processing current rollouts. This will most likely be done in batches in due course.
 * A rollout is deemed in need of processsing if 1 or more robots associated with the rollout have not
 * had their director manifest updated OR if they are not eligible for the rollout
 * 
 * Edge cases
 * 
 * 1) Robot belongs to >1 unprocessed rollouts
 *      The oldest n will be marked as 'skipped', and only the latest will be processed
 * 
 * 2) An image assoicated with a rollout has been deleted. In the images delete endpoint logic should be:
 *      
 *      It can be deleted if all assocaited RolloutRobot.status = 'successful' | 'cancelled' | 'failed'
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
export const processRollouts = async () => {

    const allTeams = await prisma.team.findMany({
        select: { id: true }
    });

    logger.debug(`${allTeams.length} teams to process rollouts`);

    for (const team of allTeams) {

        // check if any rollouts have a device in them that has yet to be processed
        const unprocessedRollouts = await prisma.rollout.findMany({
            where: {
                team_id: team.id,
                status: 'launched',
                robots: {
                    some: {
                        status: 'pending'
                    }
                }
            },
            orderBy: {
                created_at: 'asc'
            }
        });

        logger.debug(`${unprocessedRollouts.length} rollouts to process for team: ${team.id}`);

        for (const rollout of unprocessedRollouts) {

            // which robots from the rollout are still to be processed (should be doing them all in one go)
            const rolloutRobots = await prisma.rolloutRobot.findMany({
                where: {
                    rollout_id: rollout.id,
                    status: 'pending'
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
                    await setRolloutBotStatus(rollout.id, rolloutBot.robot_id!, 'skipped');
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
                        affectedEcus.push({ ecu: botEcu, image: rolloutImage.image });
                    }
                }

                //robot is not affected by the rollout
                if (affectedEcus.length === 0) {
                    await setRolloutBotStatus(rollout.id, rolloutBot.robot_id!, 'skipped');
                }

                //we need to generate new director metadata for the bot (ie is affected by the rollout)
                else {
                    await generateNewMetadata(team.id, rolloutBot.robot_id!, affectedEcus);
                    await setRolloutBotStatus(rollout.id, rolloutBot.robot_id!, 'scheduled');
                }
            }
        }
    }
}



const setRolloutBotStatus = async (rollout_id: string, robot_id: string, status: RolloutRobotStatus) => {

    await prisma.rolloutRobot.update({
        where: {
            rollout_id_robot_id: {
                rollout_id: rollout_id,
                robot_id: robot_id
            }
        },
        data: {
            status: status
        }
    });
}



const generateNewMetadata = async (team_id: string, robot_id: string, affectedEcus: { ecu: Ecu, image: Image }[]) => {

    // Lets generate the whole metadata file again
    const targetsImages: ITargetsImages = {};

    for (const affected of affectedEcus) {

        targetsImages[affected.image.id] = {
            custom: {
                ecuIdentifiers: {
                    [affected.ecu.id]: {
                        hardwareId: affected.ecu.hwid
                    }
                },
                targetFormat: String(affected.image.format).toUpperCase(),
                uri: `${config.ROBOT_GATEWAY_ORIGIN}/api/v0/robot/repo/images/${affected.image.id}`
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
    const targetsMetadata = generateSignedTargets(config.TUF_TTL.DIRECTOR.TARGETS, newTargetsVersion, targetsKeyPair, targetsImages);
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


const main = async () => {

    logger.info('rollouts processing started...');

    try {
        await processRollouts();
        logger.info('rollouts processing completed!');
    } 
    catch(e) {
        logger.error('rollouts processing failed!');
    }
}

export default main;
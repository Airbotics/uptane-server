import { ManipulateType } from 'dayjs';
import { TUFRepo, TUFRole } from '@prisma/client';
import { prisma } from '@airbotics-core/drivers';
import config from '@airbotics-config';
import { logger } from '@airbotics-core/logger';
import { dayjs } from '@airbotics-core/time';
import { generateSignedRoot, generateSignedSnapshot, generateSignedTargets, generateSignedTimestamp, getLatestMetadataVersion, getTufMetadata } from '@airbotics-core/tuf';
import { ISignedSnapshotTUF, ISignedTargetsTUF, ISignedTimestampTUF, ITimestampTUF } from '@airbotics-types';
import { keyStorage } from '@airbotics-core/key-storage';
import { getKeyStorageRepoKeyId } from '@airbotics-core/utils';
import { TUF_METADATA_LATEST } from '@airbotics-core/consts';
import { Prisma } from '@prisma/client';


/**
 * Find and resign root metadata that is about to expire.
 * 
 * Root roles live indepdently to other roles. they can expire and be
 * resigned at anytime without affecting other roles.
 */
const processRootRoles = async () => {

    try {

        // lets process the root roles, we'll get the most recent root for every repo in every team.
        // there is probably a nice way to check expiry times in prisma but for now we'll just do it in
        // js since we won't have many roots. this is left as homework.
        const mostRecentRoots = await prisma.tufMetadata.findMany({
            where: {
                role: TUFRole.root,
            },
            orderBy: {
                version: 'desc'
            },
            distinct: ['team_id', 'repo']
        });

        logger.debug(`found ${mostRecentRoots.length} root metadata files to process`);

        for (const root of mostRecentRoots) {

            // if it expires some time in the future beyond the window we care about then
            // we just continue
            if (dayjs(root.expires_at).isAfter(dayjs().add(config.TUF_EXPIRY_WINDOW[0] as number, config.TUF_EXPIRY_WINDOW[1] as ManipulateType))) {
                continue;
            }

            // otherwise it has already expired or is about to expire so we create a new signed
            // version of the file and commit it to the db
            logger.debug(`detected version ${root.version} of root for ${root.repo} repo in ${root.team_id} team is about to expire`);

            // read in keys from key storage
            const rootKeyPair = await keyStorage.getKeyPair(getKeyStorageRepoKeyId(root.team_id, root.repo, TUFRole.root));
            const targetsKeyPair = await keyStorage.getKeyPair(getKeyStorageRepoKeyId(root.team_id, root.repo, TUFRole.targets));
            const snapshotKeyPair = await keyStorage.getKeyPair(getKeyStorageRepoKeyId(root.team_id, root.repo, TUFRole.snapshot));
            const timestampKeyPair = await keyStorage.getKeyPair(getKeyStorageRepoKeyId(root.team_id, root.repo, TUFRole.timestamp));

            // bump the version
            const newVeresion = root.version + 1;

            // get expiry depending on repo
            const ttl = root.repo === TUFRepo.director ? config.TUF_TTL.DIRECTOR.ROOT : config.TUF_TTL.IMAGE.ROOT;

            const newRoot = generateSignedRoot(ttl,
                newVeresion,
                rootKeyPair,
                targetsKeyPair,
                snapshotKeyPair,
                timestampKeyPair);

            await prisma.tufMetadata.create({
                data: {
                    team_id: root.team_id,
                    repo: root.repo,
                    role: TUFRole.root,
                    version: newVeresion,
                    value: newRoot as object,
                    expires_at: newRoot.signed.expires
                }
            });

        }

    } catch (error) {
        logger.error(error);
    }
}


/**
 * Find and re-sign targets metadata that is about to expire
 * This also triggers the need to create a new snapshot since it always references the latest targets
 * and also triggers the need to create a new timestamp since it always references the latest snapshot
 * 
 * For each team 
 *  1) grab the latest targets metadata for both image and director repos
 *  2) check if its expiry is within the re-sign threshold
 *  3) compute the new version of the target metadata
 *  4) grab the target keypair
 *  5) compute the new target expiry
 *  6) generate the new target metadata
 *  7) grab the latest snapshot metadata 
 *  8) compute the new version of the snapshot metadata
 *  9) grab the snapshot keypair
 *  10) compute the new snapshot expiry
 *  11) generate the new snapshot metadata passing in the newly generated target metadata
 *  12) grab the latest timestamp metadata 
 *  13) compute the new version of the timestamp metadata
 *  14) grab the timestamp keypair
 *  15) compute the new timestamp expiry
 *  16) generate the new timestamp metadata passing in the newly generated snapshot metadata
 *  17) write all new metadata to the db
 */
const processTargetRoles = async () => {

        const latestTargets = await prisma.tufMetadata.findMany({
            where: {
                role: TUFRole.targets,
            },
            orderBy: {
                version: 'desc'
            },
            distinct: ['team_id', 'repo', 'robot_id']
        });

        for (const target of latestTargets) {

            try {

                const targetMetadata = target.value as unknown as ISignedTargetsTUF;
                const robotId: string | null = target.robot_id;

                if (dayjs(target.expires_at).isBefore(dayjs().add(config.TUF_EXPIRY_WINDOW[0] as number, config.TUF_EXPIRY_WINDOW[1] as ManipulateType))) {

                    logger.info(`detected ${target.version}.targets.json in the ${target.repo} repo (robot_id: ${robotId}) for team_id: ${target.team_id} team is about to expire`);

                    const newTargetVersion = target.version + 1;
                    const targetKeyPair = await keyStorage.getKeyPair(getKeyStorageRepoKeyId(target.team_id, target.repo, TUFRole.targets));
                    const targetTTL = target.repo === TUFRepo.image ? config.TUF_TTL.IMAGE.TARGETS : config.TUF_TTL.DIRECTOR.TARGETS;
                    const newTarget = generateSignedTargets(targetTTL, newTargetVersion, targetKeyPair, targetMetadata.signed.targets, targetMetadata.signed.custom);

                    //also need to generate a new snapshot to reference the new target
                    const latestSnapshot = await getTufMetadata(target.team_id, target.repo, TUFRole.snapshot, TUF_METADATA_LATEST, robotId) as ISignedTimestampTUF;
                    const newSnapshotVersion = latestSnapshot.signed.version + 1;
                    const snapshotKeyPair = await keyStorage.getKeyPair(getKeyStorageRepoKeyId(target.team_id, target.repo, TUFRole.snapshot));
                    const snapshotTTL = target.repo === TUFRepo.image ? config.TUF_TTL.IMAGE.SNAPSHOT : config.TUF_TTL.DIRECTOR.SNAPSHOT;
                    const newSnapshot = generateSignedSnapshot(snapshotTTL, newSnapshotVersion, snapshotKeyPair, newTarget);

                    //also need to generate a new timestamp to reference the new snapshot
                    const latestTimestamp = await getTufMetadata(target.team_id, target.repo, TUFRole.timestamp, TUF_METADATA_LATEST, robotId) as ISignedTimestampTUF;
                    const newTimestampVersion = latestTimestamp.signed.version + 1;
                    const timestampKeyPair = await keyStorage.getKeyPair(getKeyStorageRepoKeyId(target.team_id, target.repo, TUFRole.timestamp));
                    const timestampTTL = target.repo === TUFRepo.image ? config.TUF_TTL.IMAGE.TIMESTAMP : config.TUF_TTL.DIRECTOR.TIMESTAMP;
                    const newTimestamp = generateSignedTimestamp(timestampTTL, newTimestampVersion, timestampKeyPair, newSnapshot);

                    await prisma.$transaction(async tx => {
                        await tx.tufMetadata.create({
                            data: {
                                team_id: target.team_id,
                                repo: target.repo,
                                role: TUFRole.targets,
                                version: newTargetVersion,
                                value: newTarget as object,
                                robot_id: robotId,
                                expires_at: newTarget.signed.expires
                            }
                        });

                        await tx.tufMetadata.create({
                            data: {
                                team_id: target.team_id,
                                repo: target.repo,
                                role: TUFRole.snapshot,
                                version: newSnapshotVersion,
                                value: newSnapshot as object,
                                robot_id: robotId,
                                expires_at: newSnapshot.signed.expires
                            }
                        });

                        await tx.tufMetadata.create({
                            data: {
                                team_id: target.team_id,
                                repo: target.repo,
                                role: TUFRole.timestamp,
                                version: newTimestampVersion,
                                value: newTimestamp as object,
                                robot_id: robotId,
                                expires_at: newTimestamp.signed.expires
                            }
                        })
                    })

                    logger.info(`targets.json in the ${target.repo} repo for team_id: ${target.team_id} was successfully resigned`);
                    logger.info(`snapshot.json in the ${target.repo} repo for team_id: ${target.team_id} was successfully resigned`);
                    logger.info(`timestamp.json in the ${target.repo} repo for team_id: ${target.team_id} was successfully resigned`);
                }

            } catch (e) {
                logger.error(`Error resigning ${target.version}.targets.json in the ${target.repo} repo for team_id: ${target.team_id}`);
            }
        }
}



/**
 * Find and re-sign snapshot metadata that is about to expire
 * This also triggers the need to create a new timestamp since it always references the latest snapshot
 * 
 *  1) grab the latest snapshot metadata for both image and director repo for each team
 *  2) check if its expiry is within the re-sign threshold
 *  3) compute the new version of the snapshot metadata
 *  4) grab the snapshot keypair
 *  5) compute the new snapshot expiry
 *  6) grab the latest targets metadata (remember snapshot should reference latest targets)
 *  7) generate the new snapshot metadata
 *  8) grab the latest timestamp metadata 
 *  9) compute the new version of the timestamp metadata
 *  10) grab the timestamp keypair
 *  11) compute the new timestamp expiry
 *  12) generate the new timestamp metadata passing in the newly generated snapshot metadata
 *  13) write both snapshot and timestamp to db
 */
const processSnapshotRoles = async () => {

    const latestSnapshots = await prisma.tufMetadata.findMany({
        where: {
            role: TUFRole.snapshot,
        },
        orderBy: {
            version: 'desc'
        },
        distinct: ['team_id', 'repo', 'robot_id']
    });

    for (const snapshot of latestSnapshots) {

        try {

            const robotId: string | null = snapshot.robot_id;

            if (dayjs(snapshot.expires_at).isBefore(dayjs().add(config.TUF_EXPIRY_WINDOW[0] as number, config.TUF_EXPIRY_WINDOW[1] as ManipulateType))) {

                logger.info(`detected ${snapshot.version}.snapshot.json in the ${snapshot.repo} repo (robot_id: ${robotId}) for team_id: ${snapshot.team_id} team is about to expire`);

                const newSnapshotVersion = snapshot.version + 1;
                const snapshotKeyPair = await keyStorage.getKeyPair(getKeyStorageRepoKeyId(snapshot.team_id, snapshot.repo, TUFRole.snapshot));
                const snapshotTTL = snapshot.repo === TUFRepo.image ? config.TUF_TTL.IMAGE.SNAPSHOT : config.TUF_TTL.DIRECTOR.SNAPSHOT;
                const latestTargets = await getTufMetadata(snapshot.team_id, snapshot.repo, TUFRole.targets, TUF_METADATA_LATEST, robotId) as ISignedTargetsTUF;
                const newSnapshot = generateSignedSnapshot(snapshotTTL, newSnapshotVersion, snapshotKeyPair, latestTargets);

                //also need to generate a new timestamp to reference the new snapshot
                const latestTimestamp = await getTufMetadata(snapshot.team_id, snapshot.repo, TUFRole.timestamp, TUF_METADATA_LATEST, robotId) as ISignedTimestampTUF;
                const newTimestampVersion = latestTimestamp.signed.version + 1;
                const timestampKeyPair = await keyStorage.getKeyPair(getKeyStorageRepoKeyId(snapshot.team_id, snapshot.repo, TUFRole.timestamp));
                const timestampTTL = snapshot.repo === TUFRepo.image ? config.TUF_TTL.IMAGE.TIMESTAMP : config.TUF_TTL.DIRECTOR.TIMESTAMP;
                const newTimestamp = generateSignedTimestamp(timestampTTL, newTimestampVersion, timestampKeyPair, newSnapshot);

                await prisma.$transaction(async tx => {

                    await tx.tufMetadata.create({
                        data: {
                            team_id: snapshot.team_id,
                            repo: snapshot.repo,
                            role: TUFRole.snapshot,
                            version: newSnapshotVersion,
                            value: newSnapshot as object,
                            robot_id: robotId,
                            expires_at: newSnapshot.signed.expires
                        }
                    })

                    await tx.tufMetadata.create({
                        data: {
                            team_id: snapshot.team_id,
                            repo: snapshot.repo,
                            role: TUFRole.timestamp,
                            version: newTimestampVersion,
                            value: newTimestamp as object,
                            robot_id: robotId,
                            expires_at: newTimestamp.signed.expires
                        }
                    })
                })

                logger.info(`snapshot.json in the ${snapshot.repo} repo for team_id: ${snapshot.team_id} was successfully resigned`);
                logger.info(`timestamp.json in the ${snapshot.repo} repo for team_id: ${snapshot.team_id} was successfully resigned`);
            }

        } catch (e) {
            logger.error(`Error resigning ${snapshot.version}.snapshot.json in the ${snapshot.repo} repo for team_id: ${snapshot.team_id}`);
        }
    }
}



/**
 * Find and re-sign timestamp metadata that is about to expire
 * 
 *  1) grab the latest timestamp metadata for both image and director repo for each team
 *  2) check if its expiry is within the resign threshold
 *  3) compute the new version of the timestamp.json
 *  4) grab the timestamp keypair
 *  5) compute the new expiry
 *  6) grab the latest snapshot.json (remember timestamp should reference latest snapshot)
 *  7) generate the new timestamp metadata
 *  8) write it to the db
 */
const processTimestampRoles = async () => {

    const latestTimestamps = await prisma.tufMetadata.findMany({
        where: {
            role: TUFRole.timestamp,
        },
        orderBy: {
            version: 'desc'
        },
        distinct: ['team_id', 'repo', 'robot_id']
    });

    for (const timestamp of latestTimestamps) {

        try {

            const robotId: string | null = timestamp.robot_id;

            if (dayjs(timestamp.expires_at).isBefore(dayjs().add(config.TUF_EXPIRY_WINDOW[0] as number, config.TUF_EXPIRY_WINDOW[1] as ManipulateType))) {

                logger.info(`detected ${timestamp.version}.timestamp.json in the ${timestamp.repo} repo (robot_id: ${robotId}) for team_id: ${timestamp.team_id} team is about to expire`);

                const newTimestampVersion = timestamp.version + 1;
                const timestampKeyPair = await keyStorage.getKeyPair(getKeyStorageRepoKeyId(timestamp.team_id, timestamp.repo, TUFRole.timestamp));
                const timestampTTL = timestamp.repo === TUFRepo.image ? config.TUF_TTL.IMAGE.TIMESTAMP : config.TUF_TTL.DIRECTOR.TIMESTAMP;
                const latestSnapshot = await getTufMetadata(timestamp.team_id, timestamp.repo, TUFRole.snapshot, TUF_METADATA_LATEST, robotId) as ISignedSnapshotTUF;
                const newTimestamp = generateSignedTimestamp(timestampTTL, newTimestampVersion, timestampKeyPair, latestSnapshot);

                await prisma.tufMetadata.create({
                    data: {
                        team_id: timestamp.team_id,
                        repo: timestamp.repo,
                        role: TUFRole.timestamp,
                        version: newTimestampVersion,
                        value: newTimestamp as object,
                        robot_id: robotId,
                        expires_at: newTimestamp.signed.expires
                    }
                });
                logger.info(`timestamp.json in the ${timestamp.repo} repo for team_id: ${timestamp.team_id} was successfully resigned`);
            }

        } catch (e) {
            logger.error(`Error resigning ${timestamp.version}.timestamp.json in the ${timestamp.repo} repo for team_id: ${timestamp.team_id}`);
        }
    }
}





/**
 * This worker runs on the `config.WORKER_CRON` schedule and finds all tuf metadata 
 * that is about to expire within `config.TUF_EXPIRY_WINDOW` which it resigns using
 * online keys.
 */
export const resignTufRoles = async () => {

    logger.info('running background worker to resign tuf roles');

    try {
        // await processRootRoles();
        await processTargetRoles();
        await processSnapshotRoles();
        await processTimestampRoles();

    } catch (e) {
        logger.error('Error running TUF resigner worker');
        console.log(e);
    }

    logger.info('completed background worker to resign tuf roles');
}
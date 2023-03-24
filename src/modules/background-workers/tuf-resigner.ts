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


//used for various loops
const tufRepos: TUFRepo[] = [TUFRepo.image, TUFRepo.director];

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
 * For each team and for each tuf repo:
 *  1) grab the latest targets metadata
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
const processTargetRoles = async (teamIds: string[]) => {

    for (const teamId of teamIds) {
        
        for (const repo of tufRepos) {
            
            const latestTarget = await getTufMetadata(teamId, repo, TUFRole.targets, TUF_METADATA_LATEST) as ISignedTargetsTUF | null;
            if(latestTarget === null) continue;

            if (dayjs(latestTarget.signed.expires).isBefore(dayjs().add(config.TUF_EXPIRY_WINDOW[0] as number, config.TUF_EXPIRY_WINDOW[1] as ManipulateType))) {

                logger.debug(`detected version ${latestTarget.signed.version} of targets for ${repo} repo in ${teamId} team is about to expire`);
                const newTargetVersion = latestTarget.signed.version + 1;
                const targetKeyPair = await keyStorage.getKeyPair(getKeyStorageRepoKeyId(teamId, repo, TUFRole.targets));
                const targetTTL = repo === TUFRepo.image ? config.TUF_TTL.IMAGE.TARGETS : config.TUF_TTL.DIRECTOR.TARGETS;
                const newTarget = generateSignedTargets(targetTTL, newTargetVersion, targetKeyPair, latestTarget.signed.targets, latestTarget.signed.custom);

                //also need to generate a new snapshot to reference the new target
                const latestSnapshot = await getTufMetadata(teamId, repo, TUFRole.snapshot, TUF_METADATA_LATEST) as ISignedTimestampTUF;
                const newSnapshotVersion = latestSnapshot.signed.version + 1;
                const snapshotKeyPair = await keyStorage.getKeyPair(getKeyStorageRepoKeyId(teamId, repo, TUFRole.snapshot));
                const snapshotTTL = repo === TUFRepo.image ? config.TUF_TTL.IMAGE.SNAPSHOT : config.TUF_TTL.DIRECTOR.SNAPSHOT;
                const newSnapshot = generateSignedSnapshot(snapshotTTL, newSnapshotVersion, snapshotKeyPair, newTarget);
                
                //also need to generate a new timestamp to reference the new snapshot
                const latestTimestamp = await getTufMetadata(teamId, repo, TUFRole.timestamp, TUF_METADATA_LATEST) as ISignedTimestampTUF;
                const newTimestampVersion = latestTimestamp.signed.version + 1;
                const timestampKeyPair = await keyStorage.getKeyPair(getKeyStorageRepoKeyId(teamId, repo, TUFRole.timestamp));
                const timestampTTL = repo === TUFRepo.image ? config.TUF_TTL.IMAGE.TIMESTAMP : config.TUF_TTL.DIRECTOR.TIMESTAMP;
                const newTimestamp = generateSignedTimestamp(timestampTTL, newTimestampVersion, timestampKeyPair, newSnapshot);

                await prisma.$transaction(async tx => {
                    await tx.tufMetadata.create({
                        data: {
                            team_id: teamId,
                            repo: repo,
                            role: TUFRole.targets,
                            version: newTargetVersion,
                            value: newTarget as object,
                            expires_at: newTarget.signed.expires
                        }
                    });
    
                    await tx.tufMetadata.create({
                        data: {
                            team_id: teamId,
                            repo: repo,
                            role: TUFRole.snapshot,
                            version: newSnapshotVersion,
                            value: newSnapshot as object,
                            expires_at: newSnapshot.signed.expires
                        }
                    });
    
                    await tx.tufMetadata.create({
                        data: {
                            team_id: teamId,
                            repo: repo,
                            role: TUFRole.timestamp,
                            version: newTimestampVersion,
                            value: newTimestamp as object,
                            expires_at: newTimestamp.signed.expires
                        }
                    })
                })
                logger.debug(`detected version ${latestTarget.signed.version} of targets for ${repo} repo in ${teamId} was successfully resigned!`);
                logger.debug(`detected version ${latestSnapshot.signed.version} of snapshot for ${repo} repo in ${teamId} was successfully resigned!`);
                logger.debug(`detected version ${latestTimestamp.signed.version} of timestamp for ${repo} repo in ${teamId} was successfully resigned!`);
            }
        }
    }
}



/**
 * Find and re-sign snapshot metadata that is about to expire
 * This also triggers the need to create a new timestamp since it always references the latest snapshot
 * 
 * For each team and for each tuf repo:
 *  1) grab the latest snapshot metadata
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
const processSnapshotRoles = async (teamIds: string[]) => {

    for (const teamId of teamIds) {
        
        for (const repo of tufRepos) {
            
            const latestSnapshot = await getTufMetadata(teamId, repo, TUFRole.snapshot, TUF_METADATA_LATEST) as ISignedSnapshotTUF | null;
            if(latestSnapshot === null) continue;
            
            if (dayjs(latestSnapshot.signed.expires).isBefore(dayjs().add(config.TUF_EXPIRY_WINDOW[0] as number, config.TUF_EXPIRY_WINDOW[1] as ManipulateType))) {
                logger.debug(`detected version ${latestSnapshot.signed.version} of snapshot for ${repo} repo in ${teamId} team is about to expire`);
                const newSnapshotVersion = latestSnapshot.signed.version + 1;
                const snapshotKeyPair = await keyStorage.getKeyPair(getKeyStorageRepoKeyId(teamId, repo, TUFRole.snapshot));
                const snapshotTTL = repo === TUFRepo.image ? config.TUF_TTL.IMAGE.SNAPSHOT : config.TUF_TTL.DIRECTOR.SNAPSHOT;
                const latestTargets = await getTufMetadata(teamId, repo, TUFRole.targets, TUF_METADATA_LATEST) as ISignedTargetsTUF;
                const newSnapshot = generateSignedSnapshot(snapshotTTL, newSnapshotVersion, snapshotKeyPair, latestTargets);
                
                //also need to generate a new timestamp to reference the new snapshot
                const latestTimestamp = await getTufMetadata(teamId, repo, TUFRole.timestamp, TUF_METADATA_LATEST) as ISignedTimestampTUF;
                const newTimestampVersion = latestTimestamp.signed.version + 1;
                const timestampKeyPair = await keyStorage.getKeyPair(getKeyStorageRepoKeyId(teamId, repo, TUFRole.timestamp));
                const timestampTTL = repo === TUFRepo.image ? config.TUF_TTL.IMAGE.TIMESTAMP : config.TUF_TTL.DIRECTOR.TIMESTAMP;
                const newTimestamp = generateSignedTimestamp(timestampTTL, newTimestampVersion, timestampKeyPair, newSnapshot);

                await prisma.$transaction(async tx => {
                    
                    await tx.tufMetadata.create({
                        data: {
                            team_id: teamId,
                            repo: repo,
                            role: TUFRole.snapshot,
                            version: newSnapshotVersion,
                            value: newSnapshot as object,
                            expires_at: newSnapshot.signed.expires
                        }
                    })
                    
                    await tx.tufMetadata.create({
                        data: {
                            team_id: teamId,
                            repo: repo,
                            role: TUFRole.timestamp,
                            version: newTimestampVersion,
                            value: newTimestamp as object,
                            expires_at: newTimestamp.signed.expires
                        }
                    })
                })
                logger.debug(`detected version ${latestSnapshot.signed.version} of snapshot for ${repo} repo in ${teamId} was successfully resigned!`);
                logger.debug(`detected version ${latestTimestamp.signed.version} of timestamp for ${repo} repo in ${teamId} was successfully resigned!`);
            }
        }
    }
}



/**
 * Find and re-sign timestamp metadata that is about to expire
 * 
 * For each team and for each tuf repo:
 *  1) grab the latest timestamp metadata
 *  2) check if its expiry is within the resign threshold
 *  3) compute the new version of the timestamp.json
 *  4) grab the timestamp keypair
 *  5) compute the new expiry
 *  6) grab the latest snapshot.json (remember timestamp should reference latest snapshot)
 *  7) generate the new timestamp metadata
 *  8) write it to the db
 */
const processTimestampRoles = async (teamIds: string[]) => {

    for (const teamId of teamIds) {
        
        for (const repo of tufRepos) {
            
            const latestTimestamp = await getTufMetadata(teamId, repo, TUFRole.timestamp, TUF_METADATA_LATEST) as ISignedTimestampTUF | null;
            if(latestTimestamp === null) continue;

            if (dayjs(latestTimestamp.signed.expires).isBefore(dayjs().add(config.TUF_EXPIRY_WINDOW[0] as number, config.TUF_EXPIRY_WINDOW[1] as ManipulateType))) {
                logger.debug(`detected version ${latestTimestamp.signed.version} of timestamp for ${repo} repo in ${teamId} team is about to expire`);
                const newTimestampVersion = latestTimestamp.signed.version + 1;
                const timestampKeyPair = await keyStorage.getKeyPair(getKeyStorageRepoKeyId(teamId, repo, TUFRole.timestamp));
                const timestampTTL = repo === TUFRepo.image ? config.TUF_TTL.IMAGE.TIMESTAMP : config.TUF_TTL.DIRECTOR.TIMESTAMP;
                const latestSnapshot = await getTufMetadata(teamId, repo, TUFRole.snapshot, TUF_METADATA_LATEST) as ISignedSnapshotTUF;
                const newTimestamp = generateSignedTimestamp(timestampTTL, newTimestampVersion, timestampKeyPair, latestSnapshot);
                await prisma.tufMetadata.create({
                    data: {
                        team_id: teamId,
                        repo: repo,
                        role: TUFRole.timestamp,
                        version: newTimestampVersion,
                        value: newTimestamp as object,
                        expires_at: newTimestamp.signed.expires
                    }
                });
                logger.debug(`detected version ${latestTimestamp.signed.version} of timestamp for ${repo} repo in ${teamId} was successfully resigned!`);
            }
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
        
        const teamIds: string[] = (await prisma.team.findMany({
            select: { id: true }
        })).map(team => team.id);

        // await processRootRoles();
        await processTargetRoles(teamIds);
        await processSnapshotRoles(teamIds);
        await processTimestampRoles(teamIds);

    } catch(e) {
        logger.error('Error running TUF resigner worker');
        console.log(e);
    }

    logger.info('completed background worker to resign tuf roles');

}

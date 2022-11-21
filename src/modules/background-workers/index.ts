import dayjs, { ManipulateType } from 'dayjs';
import { TUFRepo, TUFRole } from '@prisma/client';
import { prisma } from '../../core/postgres';
import config from '../../config';
import { logger } from '../../core/logger';
import { generateRoot, generateSnapshot, generateTargets, generateTimestamp } from '../../core/tuf';
import { IKeyPair, ISnapshotTUF, ITargetsTUF, ITimestampTUF } from '../../types';
import { keyStorage } from '../../core/key-storage';


const getLatestMetadataVersion = async (namespace_id: string, repo: TUFRepo, role: TUFRole): Promise<number> => {

    const latest = await prisma.metadata.findFirst({
        where: {
            namespace_id,
            repo,
            role
        },
        orderBy: {
            version: 'desc'
        }
    });

    return latest ? latest.version : 0;
}

const getKeyPair = async (namespace_id: string, repo: TUFRepo, role: TUFRole): Promise<IKeyPair> => {
    return {
        privateKey: await keyStorage.getKey(`${namespace_id}-${repo}-${role}-private`),
        publicKey: await keyStorage.getKey(`${namespace_id}-${repo}-${role}-public`)
    }
}


/**
 * Find and resign root metadata that is about to expire.
 * 
 * Root roles live indepdently to other roles. they can expire and be
 * resigned at anytime without affecting other roles.
 */
const processRootRoles = async () => {

    try {

        // lets process the root roles, we'll get the most recent root for every repo in every namespace.
        // there is probably a nice way to check expiry times in prisma but for now we'll just do it in
        // js since we won't have many roots. this is left as homework.
        const mostRecentRoots = await prisma.metadata.findMany({
            where: {
                role: TUFRole.root,
            },
            orderBy: {
                version: 'desc'
            },
            distinct: ['namespace_id', 'repo']
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
            logger.debug(`detected version ${root.version} of root for ${root.repo} repo in ${root.namespace_id} namespace is about to expire`);

            // read in keys from key storage
            const rootKeyPair = await getKeyPair(root.namespace_id, root.repo, TUFRole.root);
            const targetsKeyPair = await getKeyPair(root.namespace_id, root.repo, TUFRole.targets);
            const snapshotKeyPair = await getKeyPair(root.namespace_id, root.repo, TUFRole.snapshot);
            const timestampKeyPair = await getKeyPair(root.namespace_id, root.repo, TUFRole.timestamp);

            // bump the version
            const newVeresion = root.version + 1;

            // get expiry depending on repo
            const ttl = root.repo === TUFRepo.director ? config.TUF_TTL.DIRECTOR.ROOT : config.TUF_TTL.IMAGE.ROOT;

            const newRoot = generateRoot(ttl,
                newVeresion,
                rootKeyPair,
                targetsKeyPair,
                snapshotKeyPair,
                timestampKeyPair);

            await prisma.metadata.create({
                data: {
                    namespace_id: root.namespace_id,
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
 * Find and resign targets metadata that is about to expire.
 * 
 * if we detect that the targets file of a repo in a namespace is about to expire
 * we should create a new version of it, this triggers the snapshot and timestamp for
 * that repo in that namespace to also be resigned.
 */
const processTargetRoles = async () => {

    try {

        const mostRecentTargets = await prisma.metadata.findMany({
            where: {
                role: TUFRole.targets,
            },
            orderBy: {
                version: 'desc'
            },
            distinct: ['namespace_id', 'repo']
        });

        logger.debug(`found ${mostRecentTargets.length} targets metadata files to process`);


        for (const targets of mostRecentTargets) {

            // if it expires some time in the future beyond the window we care about then
            // we just continue
            if (dayjs(targets.expires_at).isAfter(dayjs().add(config.TUF_EXPIRY_WINDOW[0] as number, config.TUF_EXPIRY_WINDOW[1] as ManipulateType))) {
                continue;
            }

            // otherwise it has already expired or is about to expire so we create a new signed
            // version of the file and commit it to the db
            logger.debug(`detected version ${targets.version} of target for ${targets.repo} repo in ${targets.namespace_id} namespace is about to expire`);

            // add one to get the new version
            const newTargetsVersion = targets.version + 1;
            const newSnapshotVersion = await getLatestMetadataVersion(targets.namespace_id, targets.repo, TUFRole.snapshot) + 1;
            const newTimeStampVersion = await getLatestMetadataVersion(targets.namespace_id, targets.repo, TUFRole.timestamp) + 1;

            // read in keys from key storage
            const targetsKeyPair = await getKeyPair(targets.namespace_id, targets.repo, TUFRole.targets);
            const snapshotKeyPair = await getKeyPair(targets.namespace_id, targets.repo, TUFRole.snapshot);
            const timestampKeyPair = await getKeyPair(targets.namespace_id, targets.repo, TUFRole.timestamp);

            // get expiry depending on repo
            const targetsTTL = targets.repo === TUFRepo.director ? config.TUF_TTL.DIRECTOR.TARGETS : config.TUF_TTL.IMAGE.TARGETS;
            const snapshotTTL = targets.repo === TUFRepo.director ? config.TUF_TTL.DIRECTOR.SNAPSHOT : config.TUF_TTL.IMAGE.SNAPSHOT;
            const timestampTTL = targets.repo === TUFRepo.director ? config.TUF_TTL.DIRECTOR.TIMESTAMP : config.TUF_TTL.IMAGE.TIMESTAMP;
            const oldTargetsTuf = targets.value as unknown as ITargetsTUF;

            const targetsMetadata = generateTargets(targetsTTL, newTargetsVersion, targetsKeyPair, oldTargetsTuf.signed.targets);
            const snapshotMetadata = generateSnapshot(snapshotTTL, newSnapshotVersion, snapshotKeyPair, targetsMetadata.signed.version);
            const timestampMetadata = generateTimestamp(timestampTTL, newTimeStampVersion, timestampKeyPair, snapshotMetadata.signed.version);

            // perform db writes in transaction
            await prisma.$transaction(async tx => {
                await tx.metadata.create({
                    data: {
                        namespace_id: targets.namespace_id,
                        repo: targets.repo,
                        role: TUFRole.targets,
                        version: newTargetsVersion,
                        value: targetsMetadata as object,
                        expires_at: targetsMetadata.signed.expires
                    }
                });

                await tx.metadata.create({
                    data: {
                        namespace_id: targets.namespace_id,
                        repo: targets.repo,
                        role: TUFRole.targets,
                        version: newSnapshotVersion,
                        value: snapshotMetadata as object,
                        expires_at: snapshotMetadata.signed.expires
                    }
                });

                await tx.metadata.create({
                    data: {
                        namespace_id: targets.namespace_id,
                        repo: targets.repo,
                        role: TUFRole.timestamp,
                        version: newTimeStampVersion,
                        value: timestampMetadata as object,
                        expires_at: timestampMetadata.signed.expires
                    }
                });
            });

        }

    } catch (error) {
        logger.error(error);
    }
}



/**
 * Find and resign snapshot metadata that is about to expire.
 */
const processSnapshotRoles = async () => {

    try {

        const mostRecentSnapshots = await prisma.metadata.findMany({
            where: {
                role: TUFRole.snapshot,
            },
            orderBy: {
                version: 'desc'
            },
            distinct: ['namespace_id', 'repo']
        });

        logger.debug(`found ${mostRecentSnapshots.length} snapshots metadata files to process`);


        for (const snapshot of mostRecentSnapshots) {

            // if it expires some time in the future beyond the window we care about then
            // we just continue
            if (dayjs(snapshot.expires_at).isAfter(dayjs().add(config.TUF_EXPIRY_WINDOW[0] as number, config.TUF_EXPIRY_WINDOW[1] as ManipulateType))) {
                continue;
            }

            // otherwise it has already expired or is about to expire so we create a new signed
            // version of the file and commit it to the db
            logger.debug(`detected version ${snapshot.version} of snapshot for ${snapshot.repo} repo in ${snapshot.namespace_id} namespace is about to expire`);

            // add one to get the new version
            const newSnapshotVersion = snapshot.version + 1;
            const newTimeStampVersion = await getLatestMetadataVersion(snapshot.namespace_id, snapshot.repo, TUFRole.timestamp) + 1;

            // read in keys from key storage
            const snapshotKeyPair = await getKeyPair(snapshot.namespace_id, snapshot.repo, TUFRole.snapshot);
            const timestampKeyPair = await getKeyPair(snapshot.namespace_id, snapshot.repo, TUFRole.timestamp);

            // get expiry depending on repo
            const snapshotTTL = snapshot.repo === TUFRepo.director ? config.TUF_TTL.DIRECTOR.SNAPSHOT : config.TUF_TTL.IMAGE.SNAPSHOT;
            const timestampTTL = snapshot.repo === TUFRepo.director ? config.TUF_TTL.DIRECTOR.TIMESTAMP : config.TUF_TTL.IMAGE.TIMESTAMP;
            const oldSnapshotTuf = snapshot.value as unknown as ISnapshotTUF;

            const snapshotMetadata = generateSnapshot(snapshotTTL, newSnapshotVersion, snapshotKeyPair, oldSnapshotTuf.signed.meta['targets.json'].version);
            const timestampMetadata = generateTimestamp(timestampTTL, newTimeStampVersion, timestampKeyPair, snapshotMetadata.signed.version);

            // perform db writes in transaction
            await prisma.$transaction(async tx => {

                await tx.metadata.create({
                    data: {
                        namespace_id: snapshot.namespace_id,
                        repo: snapshot.repo,
                        role: TUFRole.snapshot,
                        version: newSnapshotVersion,
                        value: snapshotMetadata as object,
                        expires_at: snapshotMetadata.signed.expires
                    }
                });

                await tx.metadata.create({
                    data: {
                        namespace_id: snapshot.namespace_id,
                        repo: snapshot.repo,
                        role: TUFRole.timestamp,
                        version: newTimeStampVersion,
                        value: timestampMetadata as object,
                        expires_at: timestampMetadata.signed.expires
                    }
                });
            });

        }

    } catch (error) {
        logger.error(error);
    }
}



/**
 * Find and resign timestamp metadata that is about to expire.
 */
const processTimestampRoles = async () => {

    try {

        const mostRecentTimestamps = await prisma.metadata.findMany({
            where: {
                role: TUFRole.timestamp,
            },
            orderBy: {
                version: 'desc'
            },
            distinct: ['namespace_id', 'repo']
        });

        logger.debug(`found ${mostRecentTimestamps.length} timestamps metadata files to process`);


        for (const timestamp of mostRecentTimestamps) {

            // if it expires some time in the future beyond the window we care about then
            // we just continue
            if (dayjs(timestamp.expires_at).isAfter(dayjs().add(config.TUF_EXPIRY_WINDOW[0] as number, config.TUF_EXPIRY_WINDOW[1] as ManipulateType))) {
                continue;
            }

            // otherwise it has already expired or is about to expire so we create a new signed
            // version of the file and commit it to the db
            logger.debug(`detected version ${timestamp.version} of timestamp for ${timestamp.repo} repo in ${timestamp.namespace_id} namespace is about to expire`);

            // add one to get the new version
            const newTimestampVersion = timestamp.version + 1;

            // read in keys from key storage
            const timestampKeyPair = await getKeyPair(timestamp.namespace_id, timestamp.repo, TUFRole.timestamp);

            // get expiry depending on repo
            const timestampTTL = timestamp.repo === TUFRepo.director ? config.TUF_TTL.DIRECTOR.TIMESTAMP : config.TUF_TTL.IMAGE.TIMESTAMP;
            const oldTimestampMetadata = timestamp.value as unknown as ITimestampTUF;

            const timestampMetadata = generateTimestamp(timestampTTL, newTimestampVersion, timestampKeyPair, oldTimestampMetadata.signed.meta['snapshot.json'].version);

            await prisma.metadata.create({
                data: {
                    namespace_id: timestamp.namespace_id,
                    repo: timestamp.repo,
                    role: TUFRole.timestamp,
                    version: newTimestampVersion,
                    value: timestampMetadata as object,
                    expires_at: timestampMetadata.signed.expires
                }
            });

        }

    } catch (error) {
        logger.error(error);
    }
}




/**
 * This worker runs on the `config.WORKER_CRON` schedule and finds all tuf metadata 
 * that is about to expire within `config.TUF_EXPIRY_WINDOW` which it resigns using
 * online keys.
 */
const main = async () => {

    logger.info('running background worker')

    await processRootRoles();
    await processTargetRoles();
    await processSnapshotRoles();
    await processTimestampRoles();

    logger.info('completed background worker')

}

export default main;
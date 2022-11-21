import dayjs, { ManipulateType } from 'dayjs';
// import { JsonObject } from 'prisma';
import { TUFRepo, TUFRole } from '@prisma/client';
import { prisma } from '../../core/postgres';
import config from '../../config';
import { logger } from '../../core/logger';
import { generateRoot, generateSnapshot, generateTargets, generateTimestamp } from '../../core/tuf';
import { IKeyPair, ITargetsTUF } from '../../types';
import { keyStorage } from '../../core/key-storage';


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

            logger.debug(`detected version ${root.version} of root for ${root.repo} repo in ${root.namespace_id} namespace is about to expire`);

            // otherwise it has already expired or is about to expire so we create a new signed
            // version of the file and commit it to the db

            // read in keys from key storage
            const rootKeyPair: IKeyPair = {
                privateKey: await keyStorage.getKey(`${root.namespace_id}-${root.repo}-root-private`),
                publicKey: await keyStorage.getKey(`${root.namespace_id}-${root.repo}-root-public`)
            }

            const targetsKeyPair: IKeyPair = {
                privateKey: await keyStorage.getKey(`${root.namespace_id}-${root.repo}-targets-private`),
                publicKey: await keyStorage.getKey(`${root.namespace_id}-${root.repo}-targets-public`)
            }

            const snapshotKeyPair: IKeyPair = {
                privateKey: await keyStorage.getKey(`${root.namespace_id}-${root.repo}-snapshot-private`),
                publicKey: await keyStorage.getKey(`${root.namespace_id}-${root.repo}-snapshot-public`)
            }

            const timestampKeyPair: IKeyPair = {
                privateKey: await keyStorage.getKey(`${root.namespace_id}-${root.repo}-timestamp-private`),
                publicKey: await keyStorage.getKey(`${root.namespace_id}-${root.repo}-timestamp-public`)
            }

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

            logger.debug(`detected version ${targets.version} of target for ${targets.repo} repo in ${targets.namespace_id} namespace is about to expire`);

            const latestSnapshot = await prisma.metadata.findFirst({
                where: {
                    namespace_id: targets.namespace_id,
                    repo: TUFRepo.image,
                    role: TUFRole.snapshot
                },
                orderBy: {
                    version: 'desc'
                }
            });

            const latestTimestamp = await prisma.metadata.findFirst({
                where: {
                    namespace_id: targets.namespace_id,
                    repo: TUFRepo.image,
                    role: TUFRole.timestamp
                },
                orderBy: {
                    version: 'desc'
                }
            });

            // add one to get the new version as TUF uses 1-based indexing for metadata files
            const newTargetsVersion = targets.version + 1;
            const newSnapshotVersion = latestSnapshot ? latestSnapshot.version + 1 : 1;
            const newTimeStampVersion = latestTimestamp ? latestTimestamp.version + 1 : 1;


            // otherwise it has already expired or is about to expire so we create a new signed
            // version of the file and commit it to the db

            // read in keys from key storage
            const targetsKeyPair: IKeyPair = {
                privateKey: await keyStorage.getKey(`${targets.namespace_id}-${targets.repo}-targets-private`),
                publicKey: await keyStorage.getKey(`${targets.namespace_id}-${targets.repo}-targets-public`)
            }

            const snapshotKeyPair: IKeyPair = {
                privateKey: await keyStorage.getKey(`${targets.namespace_id}-${targets.repo}-snapshot-private`),
                publicKey: await keyStorage.getKey(`${targets.namespace_id}-${targets.repo}-snapshot-public`)
            }

            const timestampKeyPair: IKeyPair = {
                privateKey: await keyStorage.getKey(`${targets.namespace_id}-${targets.repo}-timestamp-private`),
                publicKey: await keyStorage.getKey(`${targets.namespace_id}-${targets.repo}-timestamp-public`)
            }


            // get expiry depending on repo
            const targetsTTL = targets.repo === TUFRepo.director ? config.TUF_TTL.DIRECTOR.TARGETS : config.TUF_TTL.IMAGE.TARGETS;
            const snapshotTTL = targets.repo === TUFRepo.director ? config.TUF_TTL.DIRECTOR.SNAPSHOT : config.TUF_TTL.IMAGE.SNAPSHOT;
            const timestampTTL = targets.repo === TUFRepo.director ? config.TUF_TTL.DIRECTOR.TIMESTAMP : config.TUF_TTL.IMAGE.TIMESTAMP;
            const oldTargetsTuf = targets.value as unknown as ITargetsTUF;

            const targetsMetadata = generateTargets(targetsTTL, newTargetsVersion, targetsKeyPair, oldTargetsTuf.signed.targets);
            const snapshotMetadata = generateSnapshot(snapshotTTL, newSnapshotVersion, snapshotKeyPair, targetsMetadata);
            const timestampMetadata = generateTimestamp(timestampTTL, newTimeStampVersion, timestampKeyPair, snapshotMetadata);

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
 * This worker runs on the `config.WORKER_CRON` schedule and finds all tuf metadata 
 * that is about to expire within `config.TUF_EXPIRY_WINDOW` which it resigns using
 * online keys.
 */
const main = async () => {

    logger.info('running background worker')

    await processRootRoles();
    await processTargetRoles();

    logger.info('completed background worker')

}

export default main;
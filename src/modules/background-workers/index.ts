import { TUFRole } from '@prisma/client';
import { prisma } from '../../core/postgres';
import config from '../../config';
import { hoursFromNow } from '../../core/utils';
import { logger } from '../../core/logger';
import { generateRoot } from '../../core/tuf';
import { IKeyPair } from '../../types';
import { keyStorage } from '../../core/key-storage';


/**
 * This worker runs on the `config.WORKER_CRON` schedule and finds all tuf metadata 
 * that is about to expire within `config.TUF_EXPIRY_WINDOW` which it resigns using
 * online keys.
 */
const main = async () => {

    logger.info('running background worker')

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


        for (const root of mostRecentRoots) {

            // if it expires some time in the future beyond the window we care about then
            // we just continue
            if (root.expires_at.getTime() > hoursFromNow(config.TUF_EXPIRY_WINDOW).getTime()) {
                continue;
            }

            // otherwise it has already expired or is about to expire so we create a new signed
            // version of the file and commit it to the db

            // read in keys from key storage
            const rootKeyPair: IKeyPair = {
                privateKey: await keyStorage.getKey(`${root.namespace_id}-image-root-private`),
                publicKey: await keyStorage.getKey(`${root.namespace_id}-image-root-public`)
            }

            const targetsKeyPair: IKeyPair = {
                privateKey: await keyStorage.getKey(`${root.namespace_id}-image-targets-private`),
                publicKey: await keyStorage.getKey(`${root.namespace_id}-image-targets-public`)
            }

            const snapshotKeyPair: IKeyPair = {
                privateKey: await keyStorage.getKey(`${root.namespace_id}-image-snapshot-private`),
                publicKey: await keyStorage.getKey(`${root.namespace_id}-image-snapshot-public`)
            }

            const timestampKeyPair: IKeyPair = {
                privateKey: await keyStorage.getKey(`${root.namespace_id}-image-timestamp-private`),
                publicKey: await keyStorage.getKey(`${root.namespace_id}-image-timestamp-public`)
            }


            // bump the version
            const newVeresion = root.version + 1;

            const newRoot = generateRoot(config.TUF_TTL.DIRECTOR.ROOT,
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

    logger.info('completed background worker')

}

export default main;
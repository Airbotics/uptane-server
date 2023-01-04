import { TUFRepo, TUFRole } from '@prisma/client';
import { generateHash } from '@airbotics-core/crypto';
import config from '@airbotics-config';
import { toCanonical } from '@airbotics-core/utils';
import { ITufKey } from '@airbotics-types';
import { prisma } from '@airbotics-core/postgres';
import { EHashDigest } from '@airbotics-core/consts';
import { generateRoot } from './root';
import { generateTargets } from './targets';
import { generateSnapshot } from './snapshot';
import { generateTimestamp } from './timestamp';


interface IGenerateTufKeyOpts {
    isPublic: boolean;
}

/**
 * Generates a TUF key given a key.
 */
export const generateTufKey = (key: string, { isPublic }: IGenerateTufKeyOpts): ITufKey => ({
    keytype: config.TUF_KEY_TYPE,
    keyval: {
        ...(isPublic ? { public: key } : { private: key })
    }
});


/**
 * Generates a TUF key id given a TUF key.
 */
export const genKeyId = (roleKey: ITufKey): string => generateHash(toCanonical(roleKey), { hashDigest: EHashDigest.Sha256 });


/**
 * Gets the latest metadata of a given role in a repo in a namespace.
 * 
 * Will return `null` if it does not exist.
 * 
 * This does not check if the namespace or repo exists.
 */
export const getLatestMetadata = async (namespace_id: string, repo: TUFRepo, role: TUFRole, robot_id: string | null = null): Promise<any> => {

    const latest = await prisma.metadata.findFirst({
        where: {
            namespace_id,
            repo,
            role,
            robot_id
        },
        orderBy: {
            version: 'desc'
        }
    });

    return latest ? latest.value : null;
}


/**
 * Gets the first/initial metadata of a given role in a repo in a namespace.
 * 
 * Will return `null` if it does not exist.
 * 
 * This does not check if the namespace or repo exists.
 */
 export const getInitialMetadata = async (namespace_id: string, repo: TUFRepo, role: TUFRole, robot_id: string | null = null): Promise<any> => {

    const initial = await prisma.metadata.findFirst({
        where: {
            namespace_id,
            repo,
            role,
            robot_id
        },
        orderBy: {
            version: 'asc'
        }
    });

    return initial ? initial.value : null;
}


/**
 * Gets the lastest version of a given role in a repo in a namespace.
 * 
 * Will return `0` if it does not exist. This gets the most recently created metadata and grabs its version, 
 * assumes the version column in the table is always in sync with what is stored in the metadata json field.
 * 
 * This does not check if the namespace or repo exists.
 */
export const getLatestMetadataVersion = async (namespace_id: string, repo: TUFRepo, role: TUFRole, robot_id: string | null = null): Promise<number> => {
    const latest = await getLatestMetadata(namespace_id, repo, role, robot_id);
    return latest ? latest.signed.version : 0;
}


// export the remaining tuf functions
export {
    generateRoot,
    generateTargets,
    generateSnapshot,
    generateTimestamp
};
import { TUFRepo, TUFRole } from '@prisma/client';
import canonicalize from 'canonicalize';


/**
 * Serialises a Js object to canonical JSON.
 */
export const toCanonical = (data: object): string => canonicalize(data)!;


/**
 * Get key storage id for a role in a repo in a team.
 * 
 * Returns `<team_id>/<repo>/<role>`
 */
export const getKeyStorageRepoKeyId = (team_id: string, repo: TUFRepo, role: TUFRole): string => `${team_id}/${repo}/${role}`;


/**
 * Get key storage id for an ecu in a team.
 * 
 * Returns `<team_id>/<ecu_serial>`
 */
export const getKeyStorageEcuKeyId = (team_id: string, ecu_serial: string): string => `${team_id}/${ecu_serial}`;


/**
 * Does what it says.
 */
export const base64ToHex = (str: string): string => Buffer.from(str, 'base64').toString('hex');


/**
 * Transorms a base64 encoded delta to a `from` and `to` commit.
 * 
 * Example
 * Delta: M2_TV2F38wdBiLREy1xvUUcgSh81HRez7odWfAzjM_k-NdSxsgJmi+UxquZCbebOp1Qaswjy_Ft6jykJhdo251A
 * From: 336fd3576177f3074188b444cb5c6f5147204a1f351d17b3ee87567c0ce333f9.commit
 * To: 35d4b1b202668be531aae6426de6cea7541ab308f2fc5b7a8f290985da36e750.commit
 */
export const extractCommitsFromDelta = (prefix: string, suffix: string): {from: string; to: string;} => {

    const delta_id = prefix + suffix;

    const fromBase64 = delta_id.split('-')[0];
    const toBase64 = delta_id.split('-')[1];

    return {
        from: `${base64ToHex(fromBase64)}.commit`,
        to: `${base64ToHex(toBase64)}.commit`
    }

}
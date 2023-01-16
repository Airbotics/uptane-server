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
export const getKeyStorageRepoKeyId = (team_id: string, repo: TUFRepo, role: TUFRole) => `${team_id}/${repo}/${role}`;


/**
 * Get key storage id for an ecu in a team.
 * 
 * Returns `<team_id>/<ecu_serial>`
 */
export const getKeyStorageEcuKeyId = (team_id: string, ecu_serial: string) => `${team_id}/${ecu_serial}`;
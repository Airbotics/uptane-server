import { EcuStatus, TUFRepo, TUFRole } from '@prisma/client';
import canonicalize from 'canonicalize';
import { EComputedRobotStatus } from './consts';


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
 * Waits some milliseconds. Not pretty..
 */
export const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));


/**
 * Returns the robot status.
 * 
 * This is a computed based on the statuses of its ECUs
 */
export const computeRobotStatus = (ecu_statuses: EcuStatus[]): EComputedRobotStatus => {
    if (ecu_statuses.every(status => status === EcuStatus.installation_completed)) {
        return EComputedRobotStatus.Updated;
    } else if (ecu_statuses.includes(EcuStatus.installation_failed) || ecu_statuses.includes(EcuStatus.download_failed)) {
        return EComputedRobotStatus.Failed;
    } else {
        return EComputedRobotStatus.Updating;
    }
}

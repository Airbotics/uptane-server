import { Request, Response, NextFunction } from 'express';
import { ory } from '@airbotics-core/drivers/ory';
import { IdentityApiGetIdentityRequest, RelationshipApiGetRelationshipsRequest, RelationshipApiPatchRelationshipsRequest } from '@ory/client';
import { OryNamespaces, OryTeamRelations } from '@airbotics-core/consts';
import { SuccessMessageResponse, BadResponse, SuccessJsonResponse, NoContentResponse } from '@airbotics-core/network/responses';
import { logger } from '@airbotics-core/logger';
import prisma from '@airbotics-core/drivers/postgres';
import { ITeamDetail } from 'src/types';
import { auditEventEmitter } from '@airbotics-core/events';
import { generateKeyPair } from '@airbotics-core/crypto';
import config from '@airbotics-config';
import { generateSignedRoot, generateSignedSnapshot, generateSignedTargets, generateSignedTimestamp } from '@airbotics-core/tuf';
import { TUFRepo, TUFRole } from '@prisma/client';
import { blobStorage } from '@airbotics-core/blob-storage';
import { keyStorage } from '@airbotics-core/key-storage';



/**
 * Creates a new team
 * 
 * @description Performs the following:
 * 1. Create the team in our db
 * 2. Creates bucket in blob storage to hold its blobs
 * 3. Generates online TUF keys
 * 4. Creates initial image and director root.json metadata files and saves them to the db.
 * 5. Creates targets, snapshot and timestamp.json metadata files for the image repo
 * 6 Create two new relation tuples in ory
 *  a) one to say that ory_id (requester) is the admin of the new team
 *  b) one to say any admins of the new team are also members of that team
 */
export const createTeam = async (req: Request, res: Response, next: NextFunction) => {
    
    const {
        name
    } = req.body;

    const oryID = req.oryIdentity!.traits.id;

    try {

        // generate 8 TUF key pairs, 4 top-level metadata keys for 2 repos
        const imageRootKey = generateKeyPair({ keyType: config.TUF_KEY_TYPE });
        const imageTargetsKey = generateKeyPair({ keyType: config.TUF_KEY_TYPE });
        const imageSnapshotKey = generateKeyPair({ keyType: config.TUF_KEY_TYPE });
        const imageTimestampKey = generateKeyPair({ keyType: config.TUF_KEY_TYPE });

        const directorRootKey = generateKeyPair({ keyType: config.TUF_KEY_TYPE });
        const directorTargetsKey = generateKeyPair({ keyType: config.TUF_KEY_TYPE });
        const directorSnapshotKey = generateKeyPair({ keyType: config.TUF_KEY_TYPE });
        const directorTimestampKey = generateKeyPair({ keyType: config.TUF_KEY_TYPE });

        // create initial tuf metadata for TUF repos, we'll start them off at 1
        const version = 1;

        const directorRepoRoot = generateSignedRoot(config.TUF_TTL.DIRECTOR.ROOT, version,
            directorRootKey,
            directorTargetsKey,
            directorSnapshotKey,
            directorTimestampKey
        );

        const imageRepoRoot = generateSignedRoot(config.TUF_TTL.IMAGE.ROOT, version,
            imageRootKey,
            imageTargetsKey,
            imageSnapshotKey,
            imageTimestampKey
        );

        const imageRepoTargets = generateSignedTargets(config.TUF_TTL.IMAGE.TARGETS, version, imageTargetsKey, {});

        const imageRepoSnapshot = generateSignedSnapshot(config.TUF_TTL.IMAGE.SNAPSHOT, version, imageSnapshotKey, imageRepoTargets);

        const imageRepoTimestamp = generateSignedTimestamp(config.TUF_TTL.IMAGE.TIMESTAMP, version, imageTimestampKey, imageRepoSnapshot);

        const newTeam = await prisma.$transaction(async tx => {

            //Create the team in our db
            const team = await tx.team.create({
                data: {
                    name: name
                }
            });

            // image repo root.json
            await tx.metadata.create({
                data: {
                    team_id: team.id,
                    repo: TUFRepo.image,
                    role: TUFRole.root,
                    version,
                    value: imageRepoRoot as object,
                    expires_at: imageRepoRoot.signed.expires
                }
            });

            // image repo targets.json
            await tx.metadata.create({
                data: {
                    team_id: team.id,
                    repo: TUFRepo.image,
                    role: TUFRole.targets,
                    version,
                    value: imageRepoTargets as object,
                    expires_at: imageRepoTargets.signed.expires
                }
            });

            // image repo snapshot.json
            await tx.metadata.create({
                data: {
                    team_id: team.id,
                    repo: TUFRepo.image,
                    role: TUFRole.snapshot,
                    version,
                    value: imageRepoSnapshot as object,
                    expires_at: imageRepoSnapshot.signed.expires
                }
            });

            // image repo timestamp.json
            await tx.metadata.create({
                data: {
                    team_id: team.id,
                    repo: TUFRepo.image,
                    role: TUFRole.timestamp,
                    version,
                    value: imageRepoTimestamp as object,
                    expires_at: imageRepoTimestamp.signed.expires
                }
            });

            // director repo root.json
            await tx.metadata.create({
                data: {
                    team_id: team.id,
                    repo: TUFRepo.director,
                    role: TUFRole.root,
                    version,
                    value: directorRepoRoot as object,
                    expires_at: directorRepoRoot.signed.expires
                }
            });

            // create bucket in blob storage
            await blobStorage.createBucket(team.id);

            // store image repo private keys
            await keyStorage.putKey(`${team.id}-image-root-private`, imageRootKey.privateKey);
            await keyStorage.putKey(`${team.id}-image-targets-private`, imageTargetsKey.privateKey);
            await keyStorage.putKey(`${team.id}-image-snapshot-private`, imageSnapshotKey.privateKey);
            await keyStorage.putKey(`${team.id}-image-timestamp-private`, imageTimestampKey.privateKey);

            // store image repo public keys
            await keyStorage.putKey(`${team.id}-image-root-public`, imageRootKey.publicKey);
            await keyStorage.putKey(`${team.id}-image-targets-public`, imageTargetsKey.publicKey);
            await keyStorage.putKey(`${team.id}-image-snapshot-public`, imageSnapshotKey.publicKey);
            await keyStorage.putKey(`${team.id}-image-timestamp-public`, imageTimestampKey.publicKey);

            // store director repo private keys
            await keyStorage.putKey(`${team.id}-director-root-private`, directorRootKey.privateKey);
            await keyStorage.putKey(`${team.id}-director-targets-private`, directorTargetsKey.privateKey);
            await keyStorage.putKey(`${team.id}-director-snapshot-private`, directorSnapshotKey.privateKey);
            await keyStorage.putKey(`${team.id}-director-timestamp-private`, directorTimestampKey.privateKey);

            // store director repo public keys
            await keyStorage.putKey(`${team.id}-director-root-public`, directorRootKey.publicKey);
            await keyStorage.putKey(`${team.id}-director-targets-public`, directorTargetsKey.publicKey);
            await keyStorage.putKey(`${team.id}-director-snapshot-public`, directorSnapshotKey.publicKey);
            await keyStorage.putKey(`${team.id}-director-timestamp-public`, directorTimestampKey.publicKey);

            //Create the ory relationships
            const relationsParams: RelationshipApiPatchRelationshipsRequest = {
                relationshipPatch: [
                    {
                        action: 'insert',
                        relation_tuple: {
                            namespace: OryNamespaces.teams,
                            relation: OryTeamRelations.admin,
                            object: team.id,
                            subject_id: oryID
                        }
                    },
                    {
                        action: 'insert',
                        relation_tuple: {
                            namespace: OryNamespaces.teams,
                            relation: OryTeamRelations.member,
                            object: team.id,
                            subject_set: {
                                namespace: OryNamespaces.teams,
                                relation: OryTeamRelations.admin,
                                object: team.id
                            }
                        }
                    }
                ]
            }

            //returns a 201 on success
            await ory.relations.patchRelationships(relationsParams);

            return team;

        });

        auditEventEmitter.emit({
            actor_id: oryID,
            team_id: newTeam.id,
            action: 'create_team',
        });

        logger.info('created a team');
        return new SuccessJsonResponse(res, newTeam);

    } catch (error) {
        console.log(error);
        
        logger.error('A user was unable to create a new team');
        return new BadResponse(res, 'Unable to create a new team!')
    }

}



/**
 * Lists all teams a requester belongs to. 
 * 
 * @description Performs the following:
 * 1. Queries Ory for objects (teams) related to subject (user) in the 'teams' namespace 
 * 2. Queries our db for auxilary info about teams
 * 3. Return a sanitised list of teams requester
 * 
 */
export const listTeams = async (req: Request, res: Response, next: NextFunction) => {

    const oryID = req.oryIdentity!.traits.id;

    try {

        const relationsParams: RelationshipApiGetRelationshipsRequest = {
            namespace: 'teams',
            subjectId: oryID
        }

        const relationsRes = (await ory.relations.getRelationships(relationsParams)).data;

        const teamIDs: string[] = relationsRes.relation_tuples!.map(relation => relation.object);

        const teams = await prisma.team.findMany({
            where: {
                id: {
                    in: teamIDs
                }
            },
            orderBy: {
                created_at: 'desc'
            }
        });

        const sanitisedTeams: ITeamDetail[] = teams.map(team => ({
            id: team.id,
            name: team.name,
            created_at: team.created_at
        }));

        logger.info('A user read a list of their teams');
        return new SuccessJsonResponse(res, sanitisedTeams);


    } catch(error) {

    }
}



/**
 * Lists all team members in the requesters team 
 * 
 * @description Performs the following:
 * 1.Queries Ory for subjects (users) related to object (team) in the 'teams' namespace 
 * 2 For each relation that is a subject(not subject set, ie a user), we go 
 *   back to ory and get that subjects full profile info 
 * 3 Return a sanitised list of team members to the requester
 * 
 * @todo This is not super elegant, perhaps open a request for ory to be able to query
 * multiple indentities in one request
 */
export const listTeamMembers = async (req: Request, res: Response, next: NextFunction) => {

    const teamID = req.headers['air-team-id'];

    try {

        const relationsParams: RelationshipApiGetRelationshipsRequest = {
            namespace: OryNamespaces.teams,
            object: teamID
        }

        const teamRelationsRes = (await ory.relations.getRelationships(relationsParams)).data;

        const teamMembers = [];

        for (const relation of teamRelationsRes.relation_tuples!) {

            //the relation is not with a user_id so we dont care
            if (relation.subject_id) {

                const idParams: IdentityApiGetIdentityRequest = {
                    id: relation.subject_id
                }

                const identity = (await ory.identities.getIdentity(idParams)).data;

                teamMembers.push({
                    id: identity.id,
                    created_at: identity.created_at,
                    traits: {
                        id: identity.traits.id,
                        email: identity.traits.email,
                        name: {
                            first: identity.traits.name.first,
                            last: identity.traits.name.last
                        }
                    }
                })
            }
        }

        logger.info('A user read a list of the members from their team');
        return new SuccessJsonResponse(res, teamMembers);

    } catch (error) {
        logger.error('A user was unable to read a list of members from their team');
        return new BadResponse(res, 'Unable to get team members');
    }
}



/**
 * Updates an team
 * 
 * @description Updates the name of a the requesters team
 */
export const updateTeam = async (req: Request, res: Response, next: NextFunction) => {

    const teamID = req.headers['air-team-id']!;

    const {
        name
    } = req.body;

    try {

        const team = await prisma.team.update({
            where: {
                id: teamID
            },
            data: {
                name
            }
        });

        const sanitisedTeam: ITeamDetail = {
            id: team.id,
            name: team.name,
            created_at: team.created_at
        };

        auditEventEmitter.emit({
            actor_id: req.oryIdentity!.traits.id,
            team_id: teamID,
            action: 'update_team',
        })

        logger.info('A team admin has updated info about one of their teams.');
        return new SuccessJsonResponse(res, sanitisedTeam);

    } catch (error) {
        next(error);
    }

}



/**
 * Delete a team
 * 
 * - Deletes team in db, this cascades to all resources.
 * - Deletes bucket and all objects in blob storage.
 * - Deletes keys, images and treehub objects associated with this team.
 * 
 * TODO
 * - delete all keys associated with ecus in this team.
 * - remove team members in ory
 */
export const deleteTeam = async (req: Request, res: Response, next: NextFunction) => {
    
    const teamID = req.headers['air-team-id']!;

    const teamCount = await prisma.team.count({
        where: {
            id: teamID
        }
    });

    if (teamCount === 0) {
        logger.warn('could not delete a team because it does not exist');
        return res.status(400).send('could not delete team');
    }

    await prisma.$transaction(async tx => {

        // delete team in db
        await tx.team.delete({
            where: {
                id: teamID
            }
        });

        // deletes bucket in blob storage
        await blobStorage.deleteBucket(teamID);

        await keyStorage.deleteKey(`${teamID}-image-root-private`);
        await keyStorage.deleteKey(`${teamID}-image-targets-private`);
        await keyStorage.deleteKey(`${teamID}-image-snapshot-private`);
        await keyStorage.deleteKey(`${teamID}-image-timestamp-private`);

        await keyStorage.deleteKey(`${teamID}-image-root-public`);
        await keyStorage.deleteKey(`${teamID}-image-targets-public`);
        await keyStorage.deleteKey(`${teamID}-image-snapshot-public`);
        await keyStorage.deleteKey(`${teamID}-image-timestamp-public`);

        await keyStorage.deleteKey(`${teamID}-director-root-private`);
        await keyStorage.deleteKey(`${teamID}-director-targets-private`);
        await keyStorage.deleteKey(`${teamID}-director-snapshot-private`);
        await keyStorage.deleteKey(`${teamID}-director-timestamp-private`);

        await keyStorage.deleteKey(`${teamID}-director-root-public`);
        await keyStorage.deleteKey(`${teamID}-director-targets-public`);
        await keyStorage.deleteKey(`${teamID}-director-snapshot-public`);
        await keyStorage.deleteKey(`${teamID}-director-timestamp-public`);

    });

    logger.info('a user deleted a team');
    return new NoContentResponse(res, 'The team has been deleted')
}


import { Request, Response, NextFunction } from 'express';
import { RevocationReason } from '@aws-sdk/client-acm-pca';
import { ory, prisma } from '@airbotics-core/drivers';
import { KeyType, TUFRepo, TUFRole } from '@prisma/client';
import { IdentityApiGetIdentityRequest, RelationshipApiGetRelationshipsRequest, RelationshipApiDeleteRelationshipsRequest, RelationshipApiPatchRelationshipsRequest } from '@ory/client';
import { EComputedRobotStatus, EEventAction, EEventActorType, EEventResource, OryNamespaces, OryTeamRelations, TUF_METADATA_LATEST } from '@airbotics-core/consts';
import { BadResponse, SuccessJsonResponse, NoContentResponse } from '@airbotics-core/network/responses';
import { logger } from '@airbotics-core/logger';
import { IFleetOverview } from '@airbotics-types';
import { auditEvent } from '@airbotics-core/events';
import { certificateManager, generateKeyPair } from '@airbotics-core/crypto';
import config from '@airbotics-config';
import { generateSignedRoot, generateSignedSnapshot, generateSignedTargets, generateSignedTimestamp, getTufMetadata } from '@airbotics-core/tuf';
import { blobStorage } from '@airbotics-core/blob-storage';
import { keyStorage } from '@airbotics-core/key-storage';
import { getKeyStorageEcuKeyId, getKeyStorageRepoKeyId, computeRobotStatus } from '@airbotics-core/utils';
import { dayjs } from '@airbotics-core/time';
import { ITeamRes, ITeamMemberRes, IFleetOverviewRes } from 'src/types/responses';



/**
 * Creates a new team
 * 
 * - Create the team in our db
 * - Generates online TUF keys
 * - Creates initial image and director root.json metadata files and saves them to the db.
 * - Creates targets, snapshot and timestamp.json metadata files for the image repo
 * - Create two new relation tuples in ory
 *  - one to say that ory_id (requester) is the admin of the new team
 *  - one to say any admins of the new team are also members of that team
 */
export const createTeam = async (req: Request, res: Response, next: NextFunction) => {

    const oryID = req.oryIdentity!.traits.id;

    const {
        name,
        invite_code
    } = req.body;

    if (invite_code !== config.BETA_INVITE_CODE) {
        return new BadResponse(res, 'Invalid invite code');
    }

    try {

        // generate 8 TUF key pairs, 4 top-level metadata keys for 2 repos
        const imageRootKeyPair = generateKeyPair({ keyType: config.TUF_KEY_TYPE });
        const imageTargetsKeyPair = generateKeyPair({ keyType: config.TUF_KEY_TYPE });
        const imageSnapshotKeyPair = generateKeyPair({ keyType: config.TUF_KEY_TYPE });
        const imageTimestampKeyPair = generateKeyPair({ keyType: config.TUF_KEY_TYPE });

        const directorRootKeyPair = generateKeyPair({ keyType: config.TUF_KEY_TYPE });
        const directorTargetsKeyPair = generateKeyPair({ keyType: config.TUF_KEY_TYPE });
        const directorSnapshotKeyPair = generateKeyPair({ keyType: config.TUF_KEY_TYPE });
        const directorTimestampKeyPair = generateKeyPair({ keyType: config.TUF_KEY_TYPE });

        // create initial tuf metadata for TUF repos, we'll start them off at 1
        const version = 1;

        const directorRepoRoot = generateSignedRoot(config.TUF_TTL.DIRECTOR.ROOT, version,
            directorRootKeyPair,
            directorTargetsKeyPair,
            directorSnapshotKeyPair,
            directorTimestampKeyPair
        );

        const imageRepoRoot = generateSignedRoot(config.TUF_TTL.IMAGE.ROOT, version,
            imageRootKeyPair,
            imageTargetsKeyPair,
            imageSnapshotKeyPair,
            imageTimestampKeyPair
        );

        const imageRepoTargets = generateSignedTargets(config.TUF_TTL.IMAGE.TARGETS, version, imageTargetsKeyPair, {});

        const imageRepoSnapshot = generateSignedSnapshot(config.TUF_TTL.IMAGE.SNAPSHOT, version, imageSnapshotKeyPair, imageRepoTargets);

        const imageRepoTimestamp = generateSignedTimestamp(config.TUF_TTL.IMAGE.TIMESTAMP, version, imageTimestampKeyPair, imageRepoSnapshot);

        const newTeam = await prisma.$transaction(async tx => {

            // create the team in our db
            const team = await tx.team.create({
                data: {
                    name: name
                }
            });

            // image repo root.json
            await tx.tufMetadata.create({
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
            await tx.tufMetadata.create({
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
            await tx.tufMetadata.create({
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
            await tx.tufMetadata.create({
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
            await tx.tufMetadata.create({
                data: {
                    team_id: team.id,
                    repo: TUFRepo.director,
                    role: TUFRole.root,
                    version,
                    value: directorRepoRoot as object,
                    expires_at: directorRepoRoot.signed.expires
                }
            });

            // store image repo key pairs in key storage
            await keyStorage.putKeyPair(getKeyStorageRepoKeyId(team.id, TUFRepo.image, TUFRole.root), {
                publicKey: imageRootKeyPair.publicKey,
                privateKey: imageRootKeyPair.privateKey
            });
            await keyStorage.putKeyPair(getKeyStorageRepoKeyId(team.id, TUFRepo.image, TUFRole.targets), {
                publicKey: imageTargetsKeyPair.publicKey,
                privateKey: imageTargetsKeyPair.privateKey
            });
            await keyStorage.putKeyPair(getKeyStorageRepoKeyId(team.id, TUFRepo.image, TUFRole.snapshot), {
                publicKey: imageSnapshotKeyPair.publicKey,
                privateKey: imageSnapshotKeyPair.privateKey
            });
            await keyStorage.putKeyPair(getKeyStorageRepoKeyId(team.id, TUFRepo.image, TUFRole.timestamp), {
                publicKey: imageTimestampKeyPair.publicKey,
                privateKey: imageTimestampKeyPair.privateKey
            });

            // store director repo key pairs
            await keyStorage.putKeyPair(getKeyStorageRepoKeyId(team.id, TUFRepo.director, TUFRole.root), {
                publicKey: directorRootKeyPair.publicKey,
                privateKey: directorRootKeyPair.privateKey
            });
            await keyStorage.putKeyPair(getKeyStorageRepoKeyId(team.id, TUFRepo.director, TUFRole.targets), {
                publicKey: directorTargetsKeyPair.publicKey,
                privateKey: directorTargetsKeyPair.privateKey
            });
            await keyStorage.putKeyPair(getKeyStorageRepoKeyId(team.id, TUFRepo.director, TUFRole.snapshot), {
                publicKey: directorSnapshotKeyPair.publicKey,
                privateKey: directorSnapshotKeyPair.privateKey
            });
            await keyStorage.putKeyPair(getKeyStorageRepoKeyId(team.id, TUFRepo.director, TUFRole.timestamp), {
                publicKey: directorTimestampKeyPair.publicKey,
                privateKey: directorTimestampKeyPair.privateKey
            });

            console.log(getKeyStorageRepoKeyId(team.id, TUFRepo.image, TUFRole.root))


            // now store a record of them in the db
            await tx.tufKey.createMany({
                data: [
                    {
                        id: getKeyStorageRepoKeyId(team.id, TUFRepo.image, TUFRole.root),
                        team_id: team.id,
                        repo: TUFRepo.image,
                        role: TUFRole.root,
                        key_type: KeyType.rsa
                    },
                    {
                        id: getKeyStorageRepoKeyId(team.id, TUFRepo.image, TUFRole.targets),
                        team_id: team.id,
                        repo: TUFRepo.image,
                        role: TUFRole.targets,
                        key_type: KeyType.rsa
                    },
                    {
                        id: getKeyStorageRepoKeyId(team.id, TUFRepo.image, TUFRole.snapshot),
                        team_id: team.id,
                        repo: TUFRepo.image,
                        role: TUFRole.snapshot,
                        key_type: KeyType.rsa
                    },
                    {
                        id: getKeyStorageRepoKeyId(team.id, TUFRepo.image, TUFRole.timestamp),
                        team_id: team.id,
                        repo: TUFRepo.image,
                        role: TUFRole.timestamp,
                        key_type: KeyType.rsa
                    },
                    {
                        id: getKeyStorageRepoKeyId(team.id, TUFRepo.director, TUFRole.root),
                        team_id: team.id,
                        repo: TUFRepo.director,
                        role: TUFRole.root,
                        key_type: KeyType.rsa
                    },
                    {
                        id: getKeyStorageRepoKeyId(team.id, TUFRepo.director, TUFRole.targets),
                        team_id: team.id,
                        repo: TUFRepo.director,
                        role: TUFRole.targets,
                        key_type: KeyType.rsa
                    },
                    {
                        id: getKeyStorageRepoKeyId(team.id, TUFRepo.director, TUFRole.snapshot),
                        team_id: team.id,
                        repo: TUFRepo.director,
                        role: TUFRole.snapshot,
                        key_type: KeyType.rsa
                    },
                    {
                        id: getKeyStorageRepoKeyId(team.id, TUFRepo.director, TUFRole.timestamp),
                        team_id: team.id,
                        repo: TUFRepo.director,
                        role: TUFRole.timestamp,
                        key_type: KeyType.rsa
                    }
                ]
            });


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

            // returns a 201 on success
            // TODO check for success
            await ory.relations.patchRelationships(relationsParams);

            return team;

        });

        auditEvent.emit({
            resource: EEventResource.Team,
            action: EEventAction.Created,
            actor_type: EEventActorType.User,
            actor_id: oryID,
            team_id: newTeam.id,
            meta: {
                name
            }
        });

        logger.info('created a team');

        return new SuccessJsonResponse(res, newTeam);

    } catch (error) {
        console.log(error)
        logger.error('A user was unable to create a new team');
        return new BadResponse(res, 'Unable to create a new team.')
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
 * TODO
 * - return role and joined at from ory
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

        if (teams.length === 0) {
            return new SuccessJsonResponse(res, []);
        } else {

            const sanitisedTeams: ITeamRes[] = [];

            for (const [idx, team] of teams.entries()) {

                const directorRoot = await getTufMetadata(team.id, TUFRepo.director, TUFRole.root, TUF_METADATA_LATEST);
                const imageRoot = await getTufMetadata(team.id, TUFRepo.image, TUFRole.root, TUF_METADATA_LATEST);
                const imageTargets = await getTufMetadata(team.id, TUFRepo.image, TUFRole.targets, TUF_METADATA_LATEST);
                const imageSnapshot = await getTufMetadata(team.id, TUFRepo.image, TUFRole.snapshot, TUF_METADATA_LATEST);
                const imageTimestamp = await getTufMetadata(team.id, TUFRepo.image, TUFRole.timestamp, TUF_METADATA_LATEST);

                sanitisedTeams.push({
                    id: team.id,
                    name: team.name,
                    role: relationsRes.relation_tuples![idx].relation,
                    num_members: team.num_members,
                    created_at: team.created_at,
                    uptane_roles: [
                        {
                            id: 'director-root',
                            repo: TUFRepo.director,
                            role: TUFRole.root,
                            expires_at: directorRoot?.signed.expires,
                            online: true,
                            key_count: 1
                        },
                        {
                            id: 'image-root',
                            repo: TUFRepo.image,
                            role: TUFRole.root,
                            expires_at: imageRoot?.signed.expires,
                            online: true,
                            key_count: 1
                        },
                        {
                            id: 'image-targets',
                            repo: TUFRepo.image,
                            role: TUFRole.targets,
                            expires_at: imageTargets?.signed.expires,
                            online: true,
                            key_count: 1
                        },
                        {
                            id: 'image-snapshot',
                            repo: TUFRepo.image,
                            role: TUFRole.snapshot,
                            expires_at: imageSnapshot?.signed.expires,
                            online: true,
                            key_count: 1
                        },
                        {
                            id: 'image-timestamp',
                            repo: TUFRepo.image,
                            role: TUFRole.timestamp,
                            expires_at: imageTimestamp?.signed.expires,
                            online: true,
                            key_count: 1
                        }
                    ]
                });
            }

            logger.info('A user read a list of their teams');
            return new SuccessJsonResponse(res, sanitisedTeams);
        }

    } catch (error) {
        logger.info(error);
        logger.error('A user was unable to read a list of teams they belong to');
        return new BadResponse(res, 'Unable to get teams');
    }
}



/**
 * Lists all team members in the requesters team 
 * 
 * @description Performs the following:
 * 1 Queries Ory for subjects (users) related to object (team) in the 'teams' namespace 
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

        const teamMembers: ITeamMemberRes[] = [];

        for (const relation of teamRelationsRes.relation_tuples!) {

            //the relation is not with a user_id so we dont care
            if (relation.subject_id) {

                const idParams: IdentityApiGetIdentityRequest = {
                    id: relation.subject_id
                }

                const identity = (await ory.identities.getIdentity(idParams)).data;

                teamMembers.push({
                    id: identity.id,
                    name: identity.traits.name.first + ' ' + identity.traits.name.last,
                    email: identity.traits.email,
                    role: relation.relation,
                    joined_at: new Date(identity.created_at!)
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

        auditEvent.emit({
            resource: EEventResource.Team,
            action: EEventAction.DetailsUpdated,
            actor_type: EEventActorType.User,
            actor_id: req.oryIdentity!.traits.id,
            team_id: team.id,
            meta: {
                name
            }
        });


        const directorRoot = await getTufMetadata(team.id, TUFRepo.director, TUFRole.root, TUF_METADATA_LATEST);
        const imageRoot = await getTufMetadata(team.id, TUFRepo.image, TUFRole.root, TUF_METADATA_LATEST);
        const imageTargets = await getTufMetadata(team.id, TUFRepo.image, TUFRole.targets, TUF_METADATA_LATEST);
        const imageSnapshot = await getTufMetadata(team.id, TUFRepo.image, TUFRole.snapshot, TUF_METADATA_LATEST);
        const imageTimestamp = await getTufMetadata(team.id, TUFRepo.image, TUFRole.timestamp, TUF_METADATA_LATEST);

        const sanitisedTeam: ITeamRes = {
            id: team.id,
            name: team.name,
            role: OryTeamRelations.admin,
            num_members: team.num_members,
            created_at: team.created_at,
            uptane_roles: [
                {
                    id: 'director-root',
                    repo: TUFRepo.director,
                    role: TUFRole.root,
                    expires_at: directorRoot?.signed.expires,
                    online: true,
                    key_count: 1
                },
                {
                    id: 'image-root',
                    repo: TUFRepo.image,
                    role: TUFRole.root,
                    expires_at: imageRoot?.signed.expires,
                    online: true,
                    key_count: 1
                },
                {
                    id: 'image-targets',
                    repo: TUFRepo.image,
                    role: TUFRole.targets,
                    expires_at: imageTargets?.signed.expires,
                    online: true,
                    key_count: 1
                },
                {
                    id: 'image-snapshot',
                    repo: TUFRepo.image,
                    role: TUFRole.snapshot,
                    expires_at: imageSnapshot?.signed.expires,
                    online: true,
                    key_count: 1
                },
                {
                    id: 'image-timestamp',
                    repo: TUFRepo.image,
                    role: TUFRole.timestamp,
                    expires_at: imageTimestamp?.signed.expires,
                    online: true,
                    key_count: 1
                }
            ]
        };

        logger.info('A team admin has updated info about one of their teams.');
        return new SuccessJsonResponse(res, sanitisedTeam);

    } catch (error) {
        next(error);
    }

}



/**
 * Delete a team
 * 
 * Users helper function as it may be shared with account deletion
 */
export const deleteTeam = async (req: Request, res: Response, next: NextFunction) => {

    const teamId = req.headers['air-team-id']!;
    const oryId = req.oryIdentity!.traits.id;

    const teamCount = await prisma.team.count({
        where: {
            id: teamId
        }
    });

    if (teamCount === 0) {
        logger.warn('could not delete a team because it does not exist');
        return new BadResponse(res, 'Could not delete team.');
    }

    await deleteTeamHelper(teamId, oryId);

    logger.info('a user deleted a team');
    return new NoContentResponse(res, 'The team has been deleted')
}


/**
 * Delete a team
 * 
 * - Deletes team in db, this cascades to all resources.
 * - Deletes all objects in blob storage.
 * - Deletes keys, images and treehub objects associated with this team.
 * - Deletes relationships in Ory
 * 
 * May be called directly by a users request to delete a team
 * OR when an admin of a team tries to delete their account
 
*/
export const deleteTeamHelper = async (teamID: string, oryId: string) => {

    await prisma.$transaction(async tx => {

        // delete team in db
        const team = await tx.team.delete({
            where: {
                id: teamID
            },
            include: {
                ecus: true,
                certificates: true,
                robots: true
            }
        });

        // delete ecu keys
        for (const ecu of team.ecus) {
            await keyStorage.deleteKeyPair(getKeyStorageEcuKeyId(teamID, ecu.id));
        }

        // revoke all robot and provisioning credentials certs
        for (const cert of team.certificates) {
            await certificateManager.revokeCertificate(cert.serial, RevocationReason.PRIVILEGE_WITHDRAWN);
        }

        // delete all objects beginning with their team id in the treehub bucket
        await blobStorage.deleteTeamObjects(config.TREEHUB_BUCKET_NAME!, teamID);


        // delete tuf keys
        await keyStorage.deleteKeyPair(getKeyStorageRepoKeyId(teamID, TUFRepo.image, TUFRole.root));
        await keyStorage.deleteKeyPair(getKeyStorageRepoKeyId(teamID, TUFRepo.image, TUFRole.targets));
        await keyStorage.deleteKeyPair(getKeyStorageRepoKeyId(teamID, TUFRepo.image, TUFRole.snapshot));
        await keyStorage.deleteKeyPair(getKeyStorageRepoKeyId(teamID, TUFRepo.image, TUFRole.timestamp));

        await keyStorage.deleteKeyPair(getKeyStorageRepoKeyId(teamID, TUFRepo.director, TUFRole.root));
        await keyStorage.deleteKeyPair(getKeyStorageRepoKeyId(teamID, TUFRepo.director, TUFRole.targets));
        await keyStorage.deleteKeyPair(getKeyStorageRepoKeyId(teamID, TUFRepo.director, TUFRole.snapshot));
        await keyStorage.deleteKeyPair(getKeyStorageRepoKeyId(teamID, TUFRepo.director, TUFRole.timestamp));


        //finally delete all ory relationships with matching team_id
        const relationsParams: RelationshipApiDeleteRelationshipsRequest = {
            namespace: OryNamespaces.teams,
            object: team.id
        }

        await ory.relations.deleteRelationships(relationsParams)

    });

    auditEvent.emit({
        resource: EEventResource.Team,
        action: EEventAction.Deleted,
        actor_type: EEventActorType.User,
        actor_id: null,
        team_id: null,
        meta: { team_id: teamID, ory_id: oryId }
    });
}




/**
 * Delete a member from the requesters team 
 * 
 * DOES NOT YET DELETE MEMBER
 * 
 * Multi player is not yet implemented yet, so each team only has one member
 * and cannot be removed at this time.
 */
export const deleteTeamMembers = async (req: Request, res: Response, next: NextFunction) => {

    const teamID = req.headers['air-team-id']!;
    const oryID = req.oryIdentity!.traits.id;

    // auditEvent.emit({
    //     resource: EEventResource.Team,
    //     action: EEventAction.MemberRemoved,
    //     actor_type: EEventActorType.User,
    //     actor_id: oryID,
    //     team_id: teamID,
    //     meta: null
    // });

    logger.info('a user has attempted to remove a member from their team');
    return new BadResponse(res, 'You may not remove yourself from a team');
}


/**
 * Get stats overview of the fleet.
 */
export const getFleetOverview = async (req: Request, res: Response, next: NextFunction) => {

    const teamID = req.headers['air-team-id']!;

    const num_groups = await prisma.group.count({
        where: {
            team_id: teamID
        }
    });

    const num_robots = await prisma.robot.count({
        where: {
            team_id: teamID
        }
    });

    const num_images = await prisma.image.count({
        where: {
            team_id: teamID
        }
    });

    const num_rollouts = await prisma.rollout.count({
        where: {
            team_id: teamID
        }
    });

    // TODO optimise this to use sql instead of ts
    const robots = await prisma.robot.findMany({
        where: {
            team_id: teamID
        },
        include: {
            ecus: true
        }
    });

    let numRobotsUpdating = 0;
    let numRobotsUpdated = 0;
    let numRobotsFailed = 0;

    for (const robot of robots) {
        const status = computeRobotStatus(robot.ecus.map(e => e.status));
        switch (status) {
            case EComputedRobotStatus.Updating: numRobotsUpdating += 1; break;
            case EComputedRobotStatus.Updated: numRobotsUpdated += 1; break;
            case EComputedRobotStatus.Failed: numRobotsFailed += 1; break;
        }
    }



    const storage_usage = await prisma.object.aggregate({
        _sum: {
            size: true
        },
        where: {
            team_id: teamID
        }
    });

    const today = dayjs();
    const last_week = dayjs().subtract(6, 'day');

    const rollout_history: { date: string; count: number; }[] = await prisma.$queryRaw`SELECT 
            date, count(id)
        FROM
            (
                SELECT date::date 
                FROM generate_series(${last_week.toDate()}, ${today.toDate()}, '1 day'::interval) date
            ) d
            LEFT JOIN rollouts
            ON DATE_TRUNC('day', rollouts.created_at) = d.date 
            AND rollouts.team_id=${teamID}
            AND rollouts.status='launched'
        GROUP BY 
            d.date 
        ORDER BY 
            d.date ASC`;


    const stats: IFleetOverviewRes = {
        num_groups,
        num_robots,
        num_images,
        num_rollouts,
        storage_usage: storage_usage._sum.size || 0,
        rollout_history: rollout_history.map((history: any) => ({ date: history.date, count: Number(history.count) })),
        robot_status_breakdown: {
            failed: numRobotsFailed,
            updated: numRobotsUpdated,
            updating: numRobotsUpdating
        }
    }

    logger.info('a user has gotten a stats overview of their fleet');
    return new SuccessJsonResponse(res, stats);
}
import { Request, Response, NextFunction } from 'express';
import { ory } from '@airbotics-core/drivers/ory';
import { IdentityApiGetIdentityRequest, IdentityApiListIdentitiesRequest, RelationshipApiGetRelationshipsRequest, RelationshipApiPatchRelationshipsRequest } from '@ory/client';
import { OryNamespaces, OryTeamRelations } from '@airbotics-core/consts';
import { SuccessMessageResponse, BadResponse, SuccessJsonResponse } from '@airbotics-core/network/responses';
import { logger } from '@airbotics-core/logger';
import prisma from '@airbotics-core/postgres';
import { ITeamDetail, OryIdentity } from 'src/types';
import { auditEventEmitter } from '@airbotics-core/events';


/**
 * Creates a new team
 * 
 * @description Performs the following:
 * 1. Create the team in our db
 * 2 Create two new relation tuples in ory
 *  a) one to say that ory_id (requester) is the admin of the new team
 *  b) one to say any admins of the new team are also members of that team
 */
export const createTeam = async (req: Request, res: Response, next: NextFunction) => {
    const {
        name
    } = req.body;

    const oryID = req.oryIdentity!.traits.id;

    try {

        await prisma.$transaction(async tx => {

            //Create the team in our db
            const team = await tx.team.create({
                data: {
                    name: name
                }
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

            //returns a 201 on success
            await ory.relations.patchRelationships(relationsParams);

        });

        auditEventEmitter.emit({
            actor: oryID,
            action: 'create_team',
        });

        logger.info('created a team');
        return new SuccessMessageResponse(res, 'A new team has been created');

    } catch (error) {
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
            }
        });

        const sanitisedTeams: ITeamDetail[] = teams.map(team => ({
            id: team.id,
            name: team.name,
            created_at: team.created_at
        }));

        logger.error('A user read a list of their teams');
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

        logger.error('A user read a list of the members from their team');
        return new SuccessJsonResponse(res, teamMembers);

    } catch (error) {
        logger.error('A user was unable to read a list of members from their team');
        return new BadResponse(res, 'Unable to get team members')
    }
}




/**
 * Updates an team
 * 
 * @description Updates the name of a the requesters team
 */
export const updateTeam = async (req: Request, res: Response, next: NextFunction) => {

    const teamID = req.headers['air-team-id'];

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
            actor: req.oryIdentity!.traits.id,
            action: 'update_team',
        })

        logger.info('A team admin has updated info about one of their teams.');
        return new SuccessJsonResponse(res, sanitisedTeam);

    } catch (error) {
        next(error);
    }

}


import { Request, Response } from 'express';
import { IdentityApiDeleteIdentityRequest, IdentityApiUpdateIdentityRequest, RelationshipApiGetRelationshipsRequest } from '@ory/client';
import { SuccessMessageResponse, BadResponse, NoContentResponse } from '@airbotics-core/network/responses';
import { ory } from '@airbotics-core/drivers';
import config from '@airbotics-config';
import { logger } from '@airbotics-core/logger';
import { auditEvent } from '@airbotics-core/events';
import { EEventAction, EEventActorType, EEventResource, OryNamespaces, OryTeamRelations } from '@airbotics-core/consts';
import { deleteTeamHelper } from '../team/controller';

/**
 * Updates the account details of a user.
 * 
 * Notes:
 * - can only update first or last name
 * - this goes to Ory Kratos.
 */
export const updateAccount = async (req: Request, res: Response) => {

    const oryID = req.oryIdentity!.traits.id;

    const {
        first_name,
        last_name,
    } = req.body;

    try {

        const identityParms: IdentityApiUpdateIdentityRequest = {
            id: oryID,
            updateIdentityBody: {
                schema_id: config.ORY_SCHEMA_ID!,
                state: 'active',
                traits: {
                    email: req.oryIdentity!.traits.email,   //dont allow user to change for now
                    name: {
                        first: first_name,
                        last: last_name
                    }
                }
            }
        };

        await ory.identities.updateIdentity(identityParms);

        auditEvent.emit({
            resource: EEventResource.Account,
            action: EEventAction.DetailsUpdated,
            actor_type: EEventActorType.User,
            actor_id: oryID,
            team_id: null,
            meta: {
                first_name,
                last_name
            }
        });

        logger.info('a user has updated their account details');
        return new SuccessMessageResponse(res, 'Account details were updated');

    } catch (error) {
        return new BadResponse(res, 'Unable to update account details');
    }

}


/**
 * This has been written with multi player in mind. Also deleted related teams according
 * to the following
 * 
 * For each team the user is related to:
 * 
 * - If they are not an admin of any team = delete the user
 * - If they are an admin of any team
 *      - there are no other members or admins (except themselves) = delete team and account
 *      - there are other admins = delete account only
 *      - user is the only admin but there are other members = delete neither team or account
 * 
 */
export const deleteAccount = async (req: Request, res: Response) => {

    const oryID = req.oryIdentity!.traits.id;

    try {

        const userTeamParams: RelationshipApiGetRelationshipsRequest = {
            namespace: OryNamespaces.teams,
            subjectId: oryID
        }

        const userTeamRelations = (await ory.relations.getRelationships(userTeamParams)).data;

        if (!userTeamRelations.relation_tuples) throw ('Could not determine users team relations');

        const teamsUserIsAdmin = userTeamRelations.relation_tuples.filter(rel => rel.relation === OryTeamRelations.admin);

        let teamsToDelete: string[] = [];

        //user is an admin of 1 or more teams
        if (teamsUserIsAdmin.length !== 0) {

            for (const team of teamsUserIsAdmin) {

                //For each team the user is an admin of, get relations of other team members and admins
                const fullTeamParams: RelationshipApiGetRelationshipsRequest = {
                    namespace: OryNamespaces.teams,
                    object: team.object
                }
                const fullTeamRelations = (await ory.relations.getRelationships(fullTeamParams)).data;

                if (!fullTeamRelations.relation_tuples) throw ('Could not determine full team relations');

                //Count how many other admins and members the team has
                //checks are greater than one because - admin includes current user and member includes the subject_set relation of all_admins <member> team
                const otherAdminsInTeam = fullTeamRelations.relation_tuples.filter(rel => rel.relation === OryTeamRelations.admin).length > 1;
                const otherMembersInTeam = fullTeamRelations.relation_tuples.filter(rel => rel.relation === OryTeamRelations.member).length > 1;

                //no other admins in team but also no other members so safe to delete team
                if (!otherAdminsInTeam && !otherMembersInTeam) {
                    teamsToDelete.push(team.object);
                }

                //user is the only admin left in a team that still has members, not safe to delete account or team.
                else if (!otherAdminsInTeam && otherMembersInTeam) {
                    throw ('You cannot delete your account while you are the only admin in a team that has other members');
                }
            }
        }

        //delete any teams (if any)
        for(const teamId of teamsToDelete) {
            await deleteTeamHelper(teamId, oryID);
        }

        //Finally delete the account
        const deleteParams: IdentityApiDeleteIdentityRequest = {
            id: oryID
        };

        await ory.identities.deleteIdentity(deleteParams);

    } catch (error) {
        return new BadResponse(res, error);
    }

    auditEvent.emit({
        resource: EEventResource.Account,
        action: EEventAction.Deleted,
        actor_type: EEventActorType.User,
        actor_id: oryID,
        team_id: null,
        meta: null
    });

    logger.info('a user has deleted their account');
    return new NoContentResponse(res, 'Your account has been deleted!');


}
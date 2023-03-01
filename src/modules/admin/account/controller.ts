import { Request, Response } from 'express';
import { IdentityApiUpdateIdentityRequest } from '@ory/client';
import { SuccessMessageResponse, BadResponse } from '@airbotics-core/network/responses';
import { ory } from '@airbotics-core/drivers';
import config from '@airbotics-config';
import { logger } from '@airbotics-core/logger';
import { auditEvent } from '@airbotics-core/events';
import { EEventAction, EEventActorType, EEventResource } from '@airbotics-core/consts';


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
 * DOES NOT YET DELETE ACCOUNT
 * 
 * At this stage we will direct users to contact us to confirm account deletion as this 
 * could potentially be a very damaaging action
 * 
 */
export const deleteAccount = async (req: Request, res: Response) => {

    const oryID = req.oryIdentity!.traits.id;
    
    // auditEvent.emit({
    //     resource: EEventResource.Account,
    //     action: EEventAction.Deleted,
    //     actor_type: EEventActorType.User,
    //     actor_id: oryID,
    //     team_id: null,
    //     meta: null
    // });

    logger.info('a user has attempted to delete their account');
    return new BadResponse(res, 'Please contact admin@airbotics.io to delete your account');

}
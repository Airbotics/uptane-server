import { Request, Response } from 'express';
import { IdentityApiUpdateIdentityRequest } from '@ory/client';
import { SuccessMessageResponse, BadResponse } from '@airbotics-core/network/responses';
import { ory } from '@airbotics-core/drivers/ory';
import config from '@airbotics-config';
import { logger } from '@airbotics-core/logger';


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

        logger.info('a user has updated their account details');
        return new SuccessMessageResponse(res, 'Account details were updated');

    } catch (error) {
        return new BadResponse(res, 'Unable to update account details');
    }

}
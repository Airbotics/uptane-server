
import { Request, Response, NextFunction } from 'express';
import { SuccessMessageResponse, BadResponse } from '@airbotics-core/network/responses';
import { ory } from '@airbotics-core/drivers/ory';
import { IdentityApiUpdateIdentityRequest } from '@ory/client';
import config from '@airbotics-config';


export const updateAccount = async (req: Request, res: Response, next: NextFunction) => {
    
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

        return new SuccessMessageResponse(res, 'Account details were updated');


    } catch(error) {
        console.log(error.response.data.error);
        return new BadResponse(res, 'Unable to update account details');
    }





}
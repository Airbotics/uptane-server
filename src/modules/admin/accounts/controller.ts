
import { Request, Response, NextFunction } from 'express';
import { SuccessMessageResponse, BadResponse, SuccessJsonResponse, NoContentResponse } from '@airbotics-core/network/responses';
import { logger } from '@airbotics-core/logger';
import { ory } from '@airbotics-core/drivers/ory';
import { IdentityApiUpdateIdentityRequest } from '@ory/client';


export const updateAccount = async (req: Request, res: Response, next: NextFunction) => {
    
    const oryID = req.oryIdentity!.traits.id;

    const {
        first_name,
        last_name,
    } = req.body;

    try {

        console.log('hello');
        

        const identityParms: IdentityApiUpdateIdentityRequest = {
            id: oryID,
            updateIdentityBody: {
                schema_id: '700927498a3ad6cf23c86c99b9ad483bed7e98d6c4eaff5b3370b6a10e714d7ce0a1b5f306ebcae5bb80418fe6e2b9c533c81059ba77e16e54c997f5351e878b',
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
import express, { Request } from 'express';
import { logger } from '@airbotics-core/logger';
import prisma from '@airbotics-core/postgres';
import { mustBeAuthenticated } from 'src/middlewares';
import { ory } from '@airbotics-core/drivers/ory';
import { RelationshipApiPatchRelationshipsRequest } from '@ory/client';
import { OryNamespaces, OryTeamRelations } from '@airbotics-core/consts';
import { SuccessMessageResponse } from '../../core/network/responses';

const router = express.Router();

/**
 * Creates a new team
 * 
 * @description Performs the following:
 * 1. Create the team in our db
 * 2 Create two new relation tuples in ory
 *  a) one to say that ory_id (requester) is the admin of the new team
 *  b) one to say any admins of the new team are also members
 */
router.post('/', mustBeAuthenticated, async (req: Request, res) => {

    const {
        name
    } = req.body;

    const oryID = req.oryIdentity!.traits.id;

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

    logger.info('created a team');
    return new SuccessMessageResponse(res, 'A new team has been created');

});


export default router;
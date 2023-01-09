import { Request, Response, NextFunction } from 'express';
import { logger } from '@airbotics-core/logger';
import prisma from '@airbotics-core/postgres';
import { ory } from '@airbotics-core/drivers/ory';
import { BadResponse, ForbiddenResponse, UnauthorizedResponse } from '@airbotics-core/network/responses';
import { PermissionApiCheckPermissionRequest } from '@ory/client';
import { OryTeamRelations } from '@airbotics-core/consts';

/**
 * Middleware used on the director and image repo to populate the request with robot details.
 * 
 * - Will try extract the `air-client-id` header sent by the device gateway.
 * - Then try find the robot.
 * - Then populate the request of the id and the namespace it belongs to.
 * - Will prematurely return a 400 if this can't be done.
 * 
 * NOTE: the image repo doesn't ever act on the robot id.
 */
export const ensureRobotAndNamespace = async (req: Request, res: Response, next: NextFunction) => {

    const robotId = req.header('air-client-id');

    // TODO perform other validation here using joi
    if (!robotId) {
        logger.warn('robot id header was not provided');
        return res.status(400).end();
    }

    const robot = await prisma.robot.findUnique({
        where: {
            id: robotId
        }
    });

    if (!robot) {
        logger.warn('robot id header was provided but robot does not exist');
        return res.status(400).end();
    }

    req.robotGatewayPayload = {
        robot_id: robot.id,
        namespace_id: robot.namespace_id
    };

    next();

};


export const mustBeAuthenticated = async (req: Request, res: Response, next: NextFunction) => {

    try {
   
        const orySession = (await ory.frontend.toSession({ cookie: req.header("cookie") })).data;

        req.oryIdentity = {
            session_id: orySession.id,
            traits: {
                id: orySession.identity.id,
                created_at: orySession.identity.created_at!,
                state: orySession.identity.state!,
                email: orySession.identity.traits.email,
                name: {
                    first: orySession.identity.traits.name.first,
                    last: orySession.identity.traits.name.last
                }
            }
        }

        next();

    } catch (error) {
        logger.warn('An unauthenticated user is trying to access a protected endpoint');
        return new UnauthorizedResponse(res);
    }

};


export const mustBeInTeam = (relation: OryTeamRelations) => {

    return async (req: Request, res: Response, next: NextFunction) => {

        const oryID = req.oryIdentity!.traits.id;
        const teamID = req.headers['air-team-id'];
  
        if (oryID === undefined || teamID === undefined) {
            logger.warn('A user is trying to access a team protected endpoint without an oryID or teamID in the request');
            return new BadResponse(res, 'Unable to check if you have permission to do that!');
        }

        try {

            const permCheckParams: PermissionApiCheckPermissionRequest = {
                namespace: 'teams',
                object: teamID,
                relation: relation,
                subjectId: oryID
            }

            const permCheckRes = (await ory.permission.checkPermission(permCheckParams)).data;

            if (permCheckRes.allowed) {
                next();
            }
            
            else {
                return new ForbiddenResponse(res, "You do not have permission to do that!")
            }

        } catch (error) {           
            return new BadResponse(res, 'Unable to check if you have permission to do that!');
        }

    }
}
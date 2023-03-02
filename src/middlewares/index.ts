import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { FrontendApiToSessionRequest, PermissionApiCheckPermissionRequest } from '@ory/client';
import {prisma} from '@airbotics-core/drivers';
import { ory } from '@airbotics-core/drivers';
import { BadResponse, ForbiddenResponse, UnauthorizedResponse, ValidationResponse } from '@airbotics-core/network/responses';
import { OryTeamRelations, EValidationSource, OryNamespaces } from '@airbotics-core/consts';
import { logger } from '@airbotics-core/logger';


/**
 * Middleware used on the director and image repo to populate the request with robot details.
 * 
 * - Will try extract the `air-client-id` header sent by the device gateway.
 * - Then try find the robot.
 * - Then populate the request of the id and the team it belongs to.
 * - Will prematurely return a 400 if this can't be done.
 * 
 * TODO
 * - validate `air-client-id` header conforms to expectations
 */
export const mustBeRobot = async (req: Request, res: Response, next: NextFunction) => {

    const robotId = req.header('air-client-id');

    if (!robotId) {
        logger.warn('robot id header was not provided');
        return new BadResponse(res, 'could not verify robot');
    }

    const robot = await prisma.robot.findUnique({
        where: {
            id: robotId
        }
    });

    if (!robot) {
        logger.warn('robot id header was provided but robot does not exist');
        return new BadResponse(res, 'could not verify robot');
    }

    req.robotGatewayPayload = {
        robot_id: robot.id,
        team_id: robot.team_id
    };

    next();

};


/**
 * Updates the `last_seen_at` and `agent_version` fields every time a robot makes a request.
 * 
 * Note: this should always be used after `mustBeRobot` middleware, we can then be certain
 * the robot exists
 * 
 * TODO
 * - validate user-agent header conforms to expectations 
 */
export const updateRobotMeta = async (req: Request, res: Response, next: NextFunction) => {

    const { robot_id } = req.robotGatewayPayload!;
    const agent_version = req.header('user-agent');

    await prisma.robot.update({
        where: {
            id: robot_id
        },
        data: {
            agent_version,
            last_seen_at: new Date()
        }
    });

    next();

};


export const mustBeAuthenticated = async (req: Request, res: Response, next: NextFunction) => {

    try {
        
        const sessionParams: FrontendApiToSessionRequest = {
            xSessionToken: req.header("x-session-token"),       //from api authenticated clients
            cookie: req.header("cookie")                        //from browser authenticated clients
        }

        const orySession = (await ory.frontend.toSession(sessionParams)).data;
        
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
        console.log(error);
        
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
                namespace: OryNamespaces.teams,
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
            logger.error(error.response.data);
            return new BadResponse(res, 'Unable to check if you have permission to do that!');
        }

    }
}


/**
 * This returns an express middleware that will validate part of the request against a schema.
 */
export const validate = (schema: Joi.ObjectSchema, source: EValidationSource) =>
    (req: Request, res: Response, next: NextFunction): ValidationResponse | void => {

        try {

            const { error } = schema.validate(req[source], { abortEarly: false });

            if (!error) {
                return next();
            }

            const errorMessages = error.details.map((i) => i.message.replace(/['"]+/g, ''));

            logger.warn(`400 validation - ${errorMessages.toString()}`);
            return new ValidationResponse(res, errorMessages);

        } catch (error) {
            // something unknown happened, throw the error and let the global
            // error hander pick it up
            next(error);
        }

    };
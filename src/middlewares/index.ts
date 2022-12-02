import { Request, Response, NextFunction } from 'express';
import { logger } from '@airbotics-core/logger';
import prisma from '@airbotics-core/postgres';

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
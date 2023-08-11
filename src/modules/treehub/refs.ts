import express, { Request, Response } from 'express';
import { logger } from '@airbotics-core/logger';
import { prisma } from '@airbotics-core/drivers';
import { mustBeRobot, updateRobotMeta } from '@airbotics-middlewares';
import config from '@airbotics-config';
import { BadResponse, SuccessBinaryResponse, SuccessEmptyResponse } from '@airbotics-core/network/responses';

const router = express.Router();



const getRef = async (req: Request, res: Response) => {

    const team_id = req.params.team_id || req.robotGatewayPayload!.team_id;
    const name = req.params.name;

    const ref = await prisma.ref.findUnique({
        where: {
            team_id_name: {
                team_id,
                name
            }
        }
    });

    if (!ref) {
        logger.warn('could not get ostree ref because it does not exist');
        return res.status(404).end();
    }

    res.set('content-type', 'text/plain');
    return new SuccessBinaryResponse(res, ref.commit);

}


// create a ref
router.post('/refs/heads/:name', express.text({ type: '*/*', limit: config.MAX_TREEHUB_REQUEST_SIZE}), async (req: Request, res: Response) => {

    const teamID = req.headers['air-team-id']!;
    const name = req.params.name;

    const commit = req.body;

    const object_id = `${commit}.commit`;

    // check team exists
    const teamCount = await prisma.team.count({
        where: {
            id: teamID
        }
    });

    if (teamCount === 0) {
        logger.warn('could not upload ostree ref because team does not exist');
        return res.status(400).end();
    }

    // check object exists
    const objectCount = await prisma.object.count({
        where: {
            object_id
        }
    });

    if (objectCount === 0) {
        logger.warn('could not upload ostree ref because the object it references does not exist');
        return res.status(400).end();
    }

    await prisma.ref.upsert({
        create: {
            team_id: teamID,
            name,
            object_id,
            commit
        },
        update: {
            commit,
            object_id
        },
        where: {
            team_id_name: {
                team_id: teamID,
                name
            }
        }
    });

    logger.info('uploaded ostree ref');
    return res.status(200).end();
});


// get a ref
router.get('/refs/heads/:name', mustBeRobot, updateRobotMeta, getRef);


export default router;
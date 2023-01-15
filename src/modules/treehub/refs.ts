import express, { Request, Response } from 'express';
import { logger } from '@airbotics-core/logger';
import { prisma } from '@airbotics-core/drivers/postgres';
import { mustBeRobot, updateRobotMeta } from '@airbotics-middlewares';

const router = express.Router();



const getRef = async (req: Request, res: Response) => {

    const team_id = req.params.team_id || req.robotGatewayPayload!.team_id;

    // this evaluates to something like 'heads/main' so we prepend it with a forward slash
    let name = req.params.name;
    name = '/' + name;

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
        return res.status(400).send('could not download ostree ref');
    }

    res.set('content-type', 'text/plain');
    return res.status(200).send(ref.commit);

}



// create a ref
router.post('/:team_id/refs/:name(*)', express.text({ type: '*/*' }), async (req: Request, res: Response) => {

    // const teamID = req.headers['air-team-id']!;
    const team_id = req.params.team_id;

    // this evaluates to something like 'heads/main' so we prepend it with a forward slash
    let name = req.params.name;
    name = '/' + name;

    const commit = req.body;

    const object_id = `${commit}.commit`;

    // check team exists
    const teamCount = await prisma.team.count({
        where: {
            id: team_id
        }
    });

    if (teamCount === 0) {
        logger.warn('could not upload ostree ref because team does not exist');
        return res.status(400).send('could not upload ostree ref');
    }

    // check object exists
    const objectCount = await prisma.object.count({
        where: {
            object_id
        }
    });

    if (objectCount === 0) {
        logger.warn('could not upload ostree ref because the object it references does not exist');
        return res.status(400).send('could not upload ostree ref');
    }

    await prisma.ref.upsert({
        create: {
            team_id: team_id,
            name,
            object_id,
            commit
        },
        update: {
            commit
        },
        where: {
            team_id_name: {
                team_id: team_id,
                name
            }
        }
    });

    logger.info('uploaded ostree ref');
    return res.status(200).end();
});

// get a ref
router.get('/:team_id/refs/:name(*)', getRef);

// get a ref
router.get('/refs/:name(*)', mustBeRobot, updateRobotMeta, getRef);


export default router;
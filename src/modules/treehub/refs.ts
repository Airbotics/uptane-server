import express, { Request, Response } from 'express';
import { logger } from '@airbotics-core/logger';
import { prisma } from '@airbotics-core/drivers/postgres';
import { mustBeRobot } from 'src/middlewares';

const router = express.Router();


/**
 * Creates a ref
 */
router.post('/refs/:name(*)', express.text({ type: '*/*' }), async (req: Request, res: Response) => {

    const teamID = req.headers['air-team-id']!;

    // this evaluates to something like 'heads/main' so we prepend it with a forward slash
    let name = req.params.name;
    name = '/' + name;

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
            team_id: teamID,
            name,
            object_id,
            commit
        },
        update: {
            commit
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


/**
 * Gets a ref
 */
router.get('/refs/:name(*)', mustBeRobot, async (req: Request, res) => {

    const { team_id } = req.robotGatewayPayload!;

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

});


export default router;
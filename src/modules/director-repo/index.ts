import express from 'express';
import { prisma } from '../../core/postgres';


const router = express.Router();


/**
 * Create a robot in a namespace.
 */
router.post('/:namespace/robots', async (req, res) => {

    const namespace_id = req.params.namespace;

    // check namespace exists
    const namespaceCount = await prisma.namespace.count({
        where: {
            id: namespace_id
        }
    });

    if (namespaceCount === 0) {
        return res.status(400).send('could not create robot');
    }

    // create robot
    try {

        const robot = await prisma.robot.create({
            data: {
                namespace_id
            }
        });

        const response = {
            id: robot.id,
            created_at: robot.created_at,
            updated_at: robot.updated_at
        };

        return res.status(200).json(response);

    } catch (error) {
        // catch a unique constraint error code
        // someone has tried to create a robot with an existing id, return 400
        if (error.code === 'P2002') {
            return res.status(400).send('could not create robot');
        }
        // otherwise we dont know what happened so re-throw the errror and let the
        // general error catcher return it as a 500
        throw error;
    }

});


/**
 * List robots in a namespace.
 */
router.get('/:namespace/robots', async (req, res) => {

    const namespace_id = req.params.namespace;

    // check namespace exists
    const namespaceCount = await prisma.namespace.count({
        where: {
            id: namespace_id
        }
    });

    if (namespaceCount === 0) {
        return res.status(400).send('could not list robots');
    }

    // get robots
    const robots = await prisma.robot.findMany({
        where: {
            namespace_id
        },
        orderBy: {
            created_at: 'desc'
        }
    });

    const response = robots.map(robot => ({
        id: robot.id,
        created_at: robot.created_at,
        updated_at: robot.updated_at
    }));

    return res.status(200).json(response);

});


/**
 * Get detailed info about a robot in a namespace.
 */
router.get('/:namespace/robots/:robot_id', async (req, res) => {

    const namespace_id = req.params.namespace;
    const robot_id = req.params.robot_id;


    // get robot
    const robot = await prisma.robot.findUnique({
        where: {
            namespace_id_id: {
                namespace_id,
                id: robot_id
            }
        },
        include: {
            ecus: true
        }
    });

    if (!robot) {
        return res.status(400).send('could not get robot');
    }

    const response = {
        id: robot.id,
        created_at: robot.created_at,
        updated_at: robot.updated_at,
        ecus: robot.ecus.map(ecu => ({
            id: ecu.id,
            created_at: ecu.created_at,
            updated_at: ecu.updated_at,
        }))
    };

    return res.status(200).json(response);

});


/**
 * Delete a robot
 */
router.delete('/:namespace/robots/:robot_id', async (req, res) => {

    const namespace_id = req.params.namespace;
    const robot_id = req.params.robot_id;

    // try delete robot
    try {

        const robot = await prisma.robot.delete({
            where: {
                namespace_id_id: {
                    namespace_id,
                    id: robot_id
                }
            }
        });

        return res.status(200).send('deleted robot');

    } catch (error) {
        // catch deletion failure error code
        // someone has tried to create a robot that does not exist in this namespace, return 400
        if (error.code === 'P2025') {
            return res.status(400).send('could not delete robot');
        }
        // otherwise we dont know what happened so re-throw the errror and let the
        // general error catcher return it as a 500
        throw error;
    }

});



/**
 * Add an ecu to robot
 */
router.post('/:namespace/robots/:robot_id/ecus', async (req, res) => {

    const namespace_id = req.params.namespace;
    const robot_id = req.params.robot_id;

    // check namespace exists
    const namespaceCount = await prisma.namespace.count({
        where: {
            id: namespace_id
        }
    });

    if (namespaceCount === 0) {
        return res.status(400).send('could not create ecu');
    }

    // check robot exists
    const robotCount = await prisma.robot.count({
        where: {
            id: robot_id
        }
    });

    if (robotCount === 0) {
        return res.status(400).send('could not create ecu');
    }

    const ecu = await prisma.ecu.create({
        data: {
            robot_id,
            namespace_id
        }
    });
    console.log('hi')

    const response = {
        id: ecu.id,
        robot_id: ecu.robot_id,
        created_at: ecu.created_at,
        updated_at: ecu.updated_at
    };

    return res.status(200).json(response);

});



export default router;
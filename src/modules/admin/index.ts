import express from 'express';
import { prisma } from '../../core/drivers/postgres';

const router = express.Router();


/**
 * Initialises a namespace
 * 
 * - Creates namespace in db.
 * - Generates online private keys (these will be replaced by offline keys in time).
 */
router.post('/namespaces', async (req, res) => {

    const namespace = await prisma.namespace.create({
        data: {}
    });

    const response = {
        id: namespace.id,
        created_at: namespace.created_at,
        updated_at: namespace.updated_at
    };

    return res.status(200).json(response);

});



/**
 * List namespaces
 */
 router.get('/namespaces', async (req, res) => {


    const namespaces = await prisma.namespace.findMany({
        orderBy: {
            created_at: 'desc'
        }
    });

    const response = namespaces.map(namespace => ({
        id: namespace.id,
        created_at: namespace.created_at,
        updated_at: namespace.updated_at
    }))

    return res.status(200).json(response);

});


/**
 * Delete a namespace
 * 
 * - Deletes namespace in db, this cascades to all resources.
 * - Deletes keys associated with this namespace.
 */
 router.delete('/namespaces/:namespace', async (req, res) => {

    const namespace = req.params.namespace;

    await prisma.namespace.delete({
        where: {
            id: namespace
        }
    });

    return res.status(200).send('Namespace deleted');

});



export default router;
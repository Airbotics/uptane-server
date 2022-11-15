import express from 'express';
import { prisma } from '../../core/drivers/postgres';

const router = express.Router();

/**
 * Creates a ref.
 */
router.put('/:repo_id/refs/:name(*)', express.text(), async (req, res) => {

    const repo_id = req.params.repo_id;

    // this evaluates to something like 'heads/main' so we prepend it with a forward slash
    let name = req.params.name;
    name = '/' + name;

    const commit = req.body;

    const object_id = `${commit}.commit`;

    const objectCount = await prisma.object.count({
        where: {
            object_id
        }
    });

    if (objectCount === 0) {
        return res.status(400).end();
    }

    await prisma.ref.upsert({
        create: {
            repo_id,
            name,
            object_id,
            commit
        },
        update: {
            commit
        },
        where: {
            repo_id_name: {
                repo_id,
                name
            }
        }
    });

    return res.status(200).end();
});


/**
 * Gets a ref.
 */
router.get('/:repo_id/refs/:name(*)', async (req, res) => {

    const repo_id = req.params.repo_id;

    // this evaluates to something like 'heads/main' so we prepend it with a forward slash
    let name = req.params.name;
    name = '/' + name;

    const ref = await prisma.ref.findUnique({
        where: {
            repo_id_name: {
                repo_id,
                name
            }
        }
    });

    if (!ref) {
        return res.status(404).end();
    }

    res.set('content-type', 'text/plain');
    return res.status(200).send(ref.commit);

});


export default router;
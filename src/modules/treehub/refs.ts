import express from 'express';
import { prisma } from '../../core/postgres';

const router = express.Router();


/**
 * Creates a ref.
 */
router.put('/:namespace/refs/:name(*)', express.text(), async (req, res) => {

    const namespace_id = req.params.namespace;

    // this evaluates to something like 'heads/main' so we prepend it with a forward slash
    let name = req.params.name;
    name = '/' + name;

    const commit = req.body;

    const object_id = `${commit}.commit`;

    // check namespace exists
    const namespaceCount = await prisma.namespace.count({
        where: {
            id: namespace_id
        }
    });

    if (namespaceCount === 0) {
        return res.status(400).send('could not upload ostree ref');
    }

    // check object exists
    const objectCount = await prisma.object.count({
        where: {
            object_id
        }
    });

    if (objectCount === 0) {
        return res.status(400).send('could not upload ostree ref');
    }

    await prisma.ref.upsert({
        create: {
            namespace_id,
            name,
            object_id,
            commit
        },
        update: {
            commit
        },
        where: {
            namespace_id_name: {
                namespace_id,
                name
            }
        }
    });

    return res.status(200).end();
});


/**
 * Gets a ref.
 */
router.get('/:namespace/refs/:name(*)', async (req, res) => {

    const namespace_id = req.params.namespace;

    // this evaluates to something like 'heads/main' so we prepend it with a forward slash
    let name = req.params.name;
    name = '/' + name;

    const ref = await prisma.ref.findUnique({
        where: {
            namespace_id_name: {
                namespace_id,
                name
            }
        }
    });

    if (!ref) {
        return res.status(400).send('could not download ostree ref');
    }

    res.set('content-type', 'text/plain');
    return res.status(200).send(ref.commit);

});


export default router;
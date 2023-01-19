import prisma from '@airbotics-core/drivers/postgres';
import { SEED_PRIMARY_IMAGE_ID, SEED_SECONDARY_IMAGE_ID } from '../consts';


/**
 * This seeder removes the following records and cannot be undone
 * 
 * 1. All images and cascading records except for the ones
 *    with SEED_PRIMARY_IMAGE_ID or SEED_SECONDARY_IMAGE_ID
 * 2. All metadata records from the director and image repos that
 *    with a version number above 1
 * 
 */


( async () => {

    console.log('running img-rollouts seeder down...');

    await prisma.image.deleteMany({
        where: {
            id: {
                notIn: [SEED_PRIMARY_IMAGE_ID, SEED_SECONDARY_IMAGE_ID]
            }
        }
    });

    await prisma.tufMetadata.deleteMany({
        where: {
            version: { not: 1 }
        }
    })

    console.log('img-rollouts seeder down success');



})()
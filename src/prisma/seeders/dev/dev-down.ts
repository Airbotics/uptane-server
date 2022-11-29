import prisma from '@airbotics-core/postgres';


/**
 * 
 * NOTE: This seeder is designed to be one in conjunction with dev-up.ts
 * 
 * 
 * This seeder removes the following records and cannot be undone
 * 
 * 1. All namespaces
 * 2. All images  
 * 3. All robots 
 * 4. All ECUs 
 * 5. All TUF Metadata 
 * 6. All tmp rollouts
 * 
 */


( async () => {

    console.log('running dev seeder down...');

    await prisma.namespace.deleteMany();
    await prisma.image.deleteMany();
    await prisma.robot.deleteMany();
    await prisma.ecu.deleteMany();
    await prisma.metadata.deleteMany();
    await prisma.tmpEcuImages.deleteMany();

    console.log('dev seeder down success');

})()
import prisma from '../../core/postgres';

( async () => {

    console.log('Running down on dev seeder...');

    await prisma.namespace.deleteMany();
    await prisma.image.deleteMany();
    await prisma.robot.deleteMany();
    await prisma.ecu.deleteMany();
    await prisma.metadata.deleteMany();
    await prisma.tmpEcuImages.deleteMany();

    console.log('Completed down on dev seeder...')

})()
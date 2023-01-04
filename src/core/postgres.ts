import { PrismaClient } from '@prisma/client';
import config from '@airbotics-config';

export const prisma = new PrismaClient({
    // log: ['query', 'info', 'warn', 'error'],
    datasources: {
        db: {
            url: config.POSTGRES_CONN_STR
        }
    }
});

// required for jest, to export default
export default prisma;
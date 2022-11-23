import { PrismaClient } from '@prisma/client';
import config from '../config';

export const prisma = new PrismaClient({
    // log: ['query', 'info', 'warn', 'error'],
    datasources: {
        db: {
            url: config.POSTGRES_CONN_STR
        }
    }
});

// Required for jest, to export default
export default prisma;
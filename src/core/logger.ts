import dayjs from 'dayjs';
import winston from 'winston';
import config from '../config';

export const logger = winston.createLogger({
    level: config.NODE_ENV === 'production' ? 'info' : 'debug',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.File({ filename: `${config.LOGS_DIR}/${dayjs().format('YYYY-MM-DD-HH-mm-ss')}.log` }),
        new winston.transports.Console()
    ]
});
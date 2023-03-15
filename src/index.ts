import http from 'http';
import config from '@airbotics-config';
import { logger } from '@airbotics-core/logger';
import app from './app';

const httpServer = http.createServer(app);

const main = () => {

    httpServer.listen(config.PORT);
    logger.info(`listening on ${config.PORT} in ${config.NODE_ENV} mode`);
};

main();
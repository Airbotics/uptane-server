import http from 'http';
import config from './config';
import { logger } from './core/logger';
import app from './app';

const httpServer = http.createServer(app);

const main = () => {
    httpServer.listen(config.PORT);
    logger.info(`listening on ${config.PORT}`);
};

main();
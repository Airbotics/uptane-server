import http from 'http';
import { which } from 'async-shelljs';
import config from '@airbotics-config';
import { logger } from '@airbotics-core/logger';
import app from './app';

const httpServer = http.createServer(app);

const main = () => {

    if (!which('ostree')) {
        logger.error('cannot call ostree, delta generation will not work');
    }

    httpServer.listen(config.PORT);
    logger.info(`listening on ${config.PORT} in ${config.NODE_ENV} mode`);
};

main();
import http from 'http';
import config from './config';
import app from './app';

const httpServer = http.createServer(app);

const main = () => {
    httpServer.listen(config.PORT);
    console.log(`listening on ${config.PORT}`);
};

main();
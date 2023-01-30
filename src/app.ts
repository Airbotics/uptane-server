import express, { Request, Response, NextFunction } from 'express';
import hpp from 'hpp';
import helmet from 'helmet';
import schedule from 'node-schedule';
import config from '@airbotics-config'
import { logger } from '@airbotics-core/logger';
import admin from '@airbotics-modules/admin';
import treehub from '@airbotics-modules/treehub';
import imageRepo from '@airbotics-modules/image-repo';
import directorRepo from '@airbotics-modules/director-repo';
import robot from '@airbotics-modules/robot';
import rolloutWorker from '@airbotics-modules/background-workers/rollouts';


const app = express();

app.use(helmet());
app.use(hpp());
app.use(express.json({ limit: config.MAX_JSON_REQUEST_SIZE }));

// log which endpoints are hit, will only log in development
app.use((req, res, next) => {
    logger.debug(`${req.method} - ${req.originalUrl}`);
    next();
});


// health check
app.get('/', (req, res) => {
    return res.status(200).send('Welcome to the Airbotics API');
});


// mount modules
app.use('/api/v0/admin', admin);
app.use('/api/v0/robot', robot);
app.use('/api/v0/robot/director', directorRepo);
app.use('/api/v0/robot/repo', imageRepo);
app.use('/api/v0/robot/treehub', treehub);


// optionally mount a background worker in this process, if it has been configured
if(config.USE_NODE_SCHEDULER) {
    // schedule.scheduleJob(config.WORKER_CRON, backgroundWorker);
    schedule.scheduleJob(config.ROLLOUT_WORKER_CRON, rolloutWorker);
}

// handle 404
app.use((req: Request, res: Response, next: NextFunction) => {
    logger.warn(`404 - ${req.method} - ${req.originalUrl}`);
    return res.status(404).end();
});


// handle 500
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    logger.error('500');
    logger.error(err);
    return res.status(500).end();
});


export default app;
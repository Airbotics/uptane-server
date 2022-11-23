import express, { Request, Response, NextFunction } from 'express';
import hpp from 'hpp';
import helmet from 'helmet';
import schedule from 'node-schedule';
import config from './config'
import { logger } from './core/logger';
import admin from './modules/admin';
import treehub from './modules/treehub';
import imageRepo from './modules/image-repo';
import directorRepo from './modules/director-repo';
import backgroundWorker from './modules/background-workers';


const app = express();

app.use(helmet());
app.use(hpp());
app.use(express.json({ limit: config.MAX_JSON_REQUEST_SIZE }));

// log which endpoints are hit
app.use((req, res, next) => {
    logger.debug(`${req.method} - ${req.originalUrl}`);
    next();
});


// health check
app.get('/', (req, res) => {
    return res.status(200).send('Welcome to the Airbotics API');
});

app.post('/devices', (req,res) => {
    console.log(req.body)
    return res.status(400).end()
})


// mount modules
app.use('/api/v0/admin', admin);
app.use('/api/v0/director', directorRepo);
app.use('/api/v0/image', imageRepo);
app.use('/api/v0/treehub', treehub);


// optionally mount a background worker in this process, if it has been configured
if(config.USE_NODE_SCHEDULER) {
    schedule.scheduleJob(config.WORKER_CRON, backgroundWorker);
}

// handle 404
app.use((req: Request, res: Response, next: NextFunction) => {
    logger.warn(`404 - ${req.method} - ${req.originalUrl}`);
    return res.status(404).end();
});


// handle 500
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    logger.error('500');
    return res.status(500).end();
});


export default app;
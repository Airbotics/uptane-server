import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import hpp from 'hpp';
import helmet from 'helmet';
import schedule from 'node-schedule';
import config from '@airbotics-config'
import { logger } from '@airbotics-core/logger';
import { InternalServerErrorResponse, NotFoundResponse, SuccessMessageResponse } from '@airbotics-core/network/responses';
import admin from '@airbotics-modules/admin';
import treehub from '@airbotics-modules/treehub';
import imageRepo from '@airbotics-modules/image-repo';
import directorRepo from '@airbotics-modules/director-repo';
import robot from '@airbotics-modules/robot';
import webhooks from '@airbotics-modules/webhooks';
import {
    purgeExpiredProvisioningCredentials,
    resignTufRoles,
    processRollouts,
    generateStaticDeltas
} from '@airbotics-modules/background-workers';



const app = express();

app.use(helmet());
app.use(hpp());
app.use(express.json({ limit: config.MAX_JSON_REQUEST_SIZE }));

// log which endpoints are hit, will only log in development
app.use((req, res, next) => {
    logger.debug(`${req.method} - ${req.originalUrl}`);
    next();
});


app.use(cors({
    credentials: true,
    origin: config.CORS_ORIGIN,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS', 'HEAD'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Access-Control-Allow-Origin', 'Content-Disposition', 'air-team-id'],
    exposedHeaders: ['Content-Disposition']
}));

// health check
app.get('/', (req, res) => {
    return new SuccessMessageResponse(res, 'Welcome to the Airbotics API')
});


// mount modules
app.use('/api/v0/admin', admin);
app.use('/api/v0/webhooks', webhooks);
app.use('/api/v0/robot', robot);
app.use('/api/v0/robot/director', directorRepo);
app.use('/api/v0/robot/repo', imageRepo);
app.use('/api/v0/robot/treehub', treehub);


// optionally mount a background worker in this process, if it has been configured
if(config.USE_NODE_SCHEDULER === 'true') {
    schedule.scheduleJob(config.WORKERS.ROLLOUTS_CRON, processRollouts);
    schedule.scheduleJob(config.WORKERS.PROVISIONING_CREDS_EXPIRY_PURGER_CRON, purgeExpiredProvisioningCredentials);
    schedule.scheduleJob(config.WORKERS.TUF_RESIGNER_CRON, resignTufRoles);
    schedule.scheduleJob(config.WORKERS.STATIC_DELTA_GENERATOR_CRON, generateStaticDeltas);
}

// handle 404
app.use((req: Request, res: Response, next: NextFunction) => {
    logger.warn(`404 - ${req.method} - ${req.originalUrl}`);
    return new NotFoundResponse(res);
});


// handle 500
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    logger.error('500');
    logger.error(err);
    return new InternalServerErrorResponse(res);
});


export default app;
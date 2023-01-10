import * as express from 'express';
import { IncomingHttpHeaders } from 'http';
import { OryIdentity } from '../index';

declare module 'express' {
    interface Request {
        robotGatewayPayload?: {
            robot_id: string;
            team_id: string;
        },
        oryIdentity?: OryIdentity
        headers: IncomingHttpHeaders & {
            "air-team-id"?: string
        }
    }
}
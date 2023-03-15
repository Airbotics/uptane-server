import * as express from 'express';
import { IncomingHttpHeaders } from 'http';
import { IOryIdentity } from '../responses';

declare module 'express' {
    interface Request {
        robotGatewayPayload?: {
            robot_id: string;
            team_id: string;
        },
        oryIdentity?: IOryIdentity
        headers: IncomingHttpHeaders & {
            "air-team-id"?: string
        }
    }
}
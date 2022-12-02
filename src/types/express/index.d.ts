import * as express from 'express';

declare module 'express' {
    interface Request {
        robotGatewayPayload?: {
            robot_id: string;
            namespace_id: string;
        };
    }
}
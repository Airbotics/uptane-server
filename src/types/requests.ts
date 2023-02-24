export interface IRobotTelemetryReq {
    deviceTime: string;
    event: {
        ecu: string;
        success?: boolean;
    };
    eventType: {
        id: string;
        version: number;
    };
    id: string;
};
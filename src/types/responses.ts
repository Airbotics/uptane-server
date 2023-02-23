import { ImageFormat, RolloutRobotStatus, RolloutStatus } from "@prisma/client";


/**
 * Robots
 */
export interface IRobotRes {
    id: string;
    name: string;
    status: RolloutRobotStatus;
    group_count: number;
    created_at: Date;
};


export interface IRobotDetailRes {
    id: string;
    name: string;
    status: RolloutRobotStatus;
    created_at: Date;
    updated_at: Date;
    agent_version: string | null;
    ecus_registered: boolean;
    groups: {
        id: string;
        name: string;
    }[],
    robot_manifests: {
        id: string,
        valid: boolean,
        created_at: Date
    }[],
    ecus: {
        id: string;
        primary: boolean;
        hw_id: string;
        created_at: Date;
        updated_at: Date;
        installed_image?: {
            id: string;
            name: string;
            format: ImageFormat
            size: number
        }
    }[],
    latest_network_report?: {
        created_at: Date | null;
        hostname: string | null;
        local_ipv4: string | null;
        mac: string | null;
    },
    certificates: {
        id: string;
        serial: string;
        created_at: Date;
        expires_at: Date;
        status: string;
        revoked_at: Date | null;
    }[]
}



export interface IEcuTelemetryRes {
    id: string;
    ecu: {
        id: string;
        hw_id: string;
    }
    event_type: string;
    success: boolean | null;
    device_time: Date;
}


export interface IRobotGroupRes {
    group_id: string;
    name: string;
    created_at: string;
}


export interface IRobotRolloutRes {
    id: string;
    status: RolloutRobotStatus;
    created_at: Date;
    rollout: {
        id: string;
        name: string;
        status: RolloutStatus;
    }
}




/**
 * Images
 */

export interface IImageRobotRes {
    robot: {
        id: string;
        name: string | null;
    },
    ecu: {
        id: string;
        hw_id: string;
        primary: boolean;
        updated_at: Date
    }
}





/**
 * Rollouts
 */

export interface IRolloutRes {
    id: string;
    name: string;
    description: string;
    status: RolloutStatus;
    created_at: Date;
    updated_at: Date;
}


export interface IRolloutDetailRes {
    id: string;
    name: string;
    description: string;
    status: RolloutStatus;
    created_at: Date;
    updated_at: Date;
    robots: {
        id: string,
        status: RolloutRobotStatus
    }[]
}

export interface IRolloutAffectedBotRes {
    id: string;
    name: string;
    ecus_affected: {
        id: string;
        hwid: string;
        update_from: string;
    }[]
}

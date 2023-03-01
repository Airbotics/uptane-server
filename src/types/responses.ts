import { EComputedRobotStatus } from "@airbotics-core/consts";
import { CertificateStatus, EcuStatus, ImageFormat, RobotStatus, RolloutStatus } from "@prisma/client";


/**
 * Robots
 */
export interface IRobotRes {
    id: string;
    name: string | null;
    status: EComputedRobotStatus,
    group_count: number;
    created_at: Date;
    last_seen_at: Date | null;
};


export interface IRobotDetailRes {
    id: string;
    name: string | null;
    description: string | null;
    last_seen_at: Date | null;
    created_at: Date;
    updated_at: Date;
    agent_version: string | null;
    ecus_registered: boolean;
    status: EComputedRobotStatus;
    groups: {
        id: string;
        name: string;
    }[];
    robot_manifests: {
        id: string,
        valid: boolean,
        created_at: Date
    }[];
    ecus: {
        id: string;
        primary: boolean;
        status: EcuStatus;
        hw_id: string;
        created_at: Date;
        updated_at: Date;
        installed_image?: {
            id: string;
            name: string;
            format: ImageFormat
            size: number
        }
    }[];
    latest_network_report?: {
        created_at: Date | null;
        hostname: string | null;
        local_ipv4: string | null;
        mac: string | null;
    };
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
    };
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
    status: RobotStatus;
    created_at: Date;
    rollout: {
        id: string;
        name: string;
        status: RolloutStatus;
    };
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
        status: RobotStatus
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


/**
 * PROVISIONING CREDENTIALS
 */
export interface ICreateCredentialsRes {
    id: string;
}


export interface ICredentialsRes {
    id: string;
    name: string;
    status: CertificateStatus;
    expires_at: Date;
    created_at: Date;
    revoked_at: Date | null;
}

export interface IFleetOverview {
    num_groups: number;
    num_robots: number;
    num_images: number;
    num_rollouts: number;
    storage_usage: number;
    rollout_history: {
        date: string;
        count: number;
    }[];
    robot_status_breakdown: {
        up_to_date: number;
        pending: number;
        underway: number;
    };
}
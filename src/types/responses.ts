import { CertificateStatus, EcuStatus, ImageFormat, RolloutRobotStatus, RolloutStatus, RolloutTargetType } from '@prisma/client';
import { EComputedRobotStatus} from '@airbotics-core/consts';
import { TUFRepo, TUFRole } from '@prisma/client';

/**
 * ORY
 */
export interface IOryIdentity {
    session_id: string;
    traits: {
        id: string;
        created_at: string;
        state: string;  //active or inactive
        email: string;
        name: {
            first: string;
            last: string;
        }
    }
}


/**
 * Teams
 */
export interface ITeamRes {
    id: string;
    name: string;
    role: string;
    num_members: number
    created_at: Date;
    uptane_roles: {
        id: string;
        repo: TUFRepo,
        role: TUFRole,
        expires_at: string | undefined;
        online: boolean;
        key_count: number;
    }[];
}

export interface ITeamMemberRes {
    id: string;
    name: string;
    email: string;
    role: string;
    joined_at: Date;
}


/**
 * Fleet overview
 */
export interface IFleetOverviewRes {
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
        failed: number;
        updated: number;
        updating: number;
    };
}


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
    };
}




/**
 * Images
 */

export interface IImageRes {
    id: string;
    name: string;
    target_id: string;
    size: number;
    sha256: string;
    hwids: string[];
    created_at: Date;
}

export interface IImageDetailRes extends IImageRes {
    description: string | null;
    format: ImageFormat;
}

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
    description: string | null;
    status: RolloutStatus;
    created_at: Date;
    updated_at: Date;
}


export interface IRolloutDetailRes {
    id: string;
    name: string;
    description: string | null;
    target_type: RolloutTargetType;
    status: RolloutStatus;
    created_at: Date;
    updated_at: Date;
    robots: {
        id: string | null;
        name: string | null;
        status: RolloutRobotStatus;
        ecus: {
            id: string,
            status: EcuStatus | null,
            hw_id: string;
            image?: {
                id: string, 
                target_id: string
            }
        }[]
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
        failed: number;
        updated: number;
        updating: number;
    };
}
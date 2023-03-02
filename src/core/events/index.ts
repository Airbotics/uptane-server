import { EAktualizrEvent, EEventAction, EEventActorType, EEventResource } from '@airbotics-core/consts';
import { logger } from '@airbotics-core/logger';
import EventEmitter from 'events';
import { rolloutEventHandler } from './rollout-handler';
import { auditEventHandler } from './audit-event-handler';

/**
 * Notes:
 * - If an action is done on an account then the team_id will be null.
 * - If an action is done by the airbotics-bot then the actor_id will be null.
 */
export interface AuditEvent {
    team_id: string | null; 
    actor_type: EEventActorType;
    actor_id: string | null;
    resource: EEventResource;
    action: EEventAction;
    meta: object | null;
}


export interface AktualizrEvent {
    id: string;
    deviceTime: string;
    eventType: {
        id: EAktualizrEvent;
        version: number;
    };
    event: {
        correlationId?: string;
        ecu?: string;
        success?: boolean;
    };
};


class AirEventEmitter<T> {

    private topic: string;
    private emitter: EventEmitter = new EventEmitter();

    constructor(topic: string) {
        this.topic = topic;
    }

    public addListener(listener: (event: T) => void) {
        this.emitter.addListener(this.topic, listener);
    }

    public emit(val: T) {
        this.emitter.emit(this.topic, val);
    }

}

export const auditEvent = new AirEventEmitter<AuditEvent>('audit');
auditEvent.addListener(auditEventHandler);

export const aktualizrEvent = new AirEventEmitter<AktualizrEvent>('agent');

aktualizrEvent.addListener(rolloutEventHandler);
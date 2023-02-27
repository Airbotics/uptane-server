import { EAktualizrEvent, EEventAction, EEventActorType, EEventResource } from '@airbotics-core/consts';
import { logger } from '@airbotics-core/logger';
import EventEmitter from 'events';
import { rolloutEventHandler } from './rolloutHandler';

/**
 * Notes:
 * - If an action is done on an account then the team_id will be null.
 * - If an action is done by the airbotics-bot then the actor_id will be null.
 */
export interface AirEvent {
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

    private emitter: EventEmitter = new EventEmitter();

    public addListener(listener: (event: T) => void, eventType: string = 'default') {
        this.emitter.addListener(eventType, listener);
    }

    public emit(val: T, eventType: string = 'default') {
        this.emitter.emit(eventType, val);
    }

}

export const airEvent = new AirEventEmitter<AirEvent>();

export const aktualizrEvent = new AirEventEmitter<AktualizrEvent>();

aktualizrEvent.addListener(rolloutEventHandler);
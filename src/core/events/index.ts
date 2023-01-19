import { EEventAction, EEventActorType, EEventResource } from '@airbotics-core/consts';
import EventEmitter from 'events';

/**
 * Notes:
 * - If an action is done on an account then the team_id will be null.
 * - If an action is done by the airbotics-bot then the actor_id will be null.
 */
interface AirEvent {
    team_id: string | null; 
    actor_type: EEventActorType;
    actor_id: string | null;
    resource: EEventResource;
    action: EEventAction;
    meta: object | null;
}

class AirEventEmitter {

    private emitter: EventEmitter = new EventEmitter();

    public addListener(listener: (event: AirEvent) => void) {
        this.emitter.addListener('default', listener)
    }

    public emit(val: AirEvent) {
        this.emitter.emit('default', val);
    }

}

export const airEvent = new AirEventEmitter();
import EventEmitter from "node:events";

interface AirAuditEvent {
    actor: string;
    producer: string;
    action: string;
}

interface AirOtherEvent {
    producer: string;
    created_at: Date;
}

class AirEventEmitter<T> {

    private topic: string;
    private emitter: EventEmitter = new EventEmitter();

    constructor(topic: string) {
        this.topic = topic;
    }

    public addListener(listener: (event: T) => void ) {
        this.emitter.addListener(this.topic, listener)
    }
    
    public emit(val: T) {
        this.emitter.emit(this.topic, val);
    }

}

export const auditEventEmitter = new AirEventEmitter<AirAuditEvent>('audit');
export const otherEventEmitter = new AirEventEmitter<AirOtherEvent>('other');


auditEventEmitter.addListener((event: AirAuditEvent) => {
    //TODO: put this into log storage
    console.log(event);
})
import { Prisma } from '@prisma/client';
import { prisma } from '@airbotics-core/drivers';
import { AuditEvent } from '.';


export const auditEventHandler = async (event: AuditEvent) => {

    await prisma.auditEvent.create({
        data: {
            resource: event.resource,
            action: event.action,
            actor_type: event.actor_type,
            actor_id: event.actor_id,
            team_id: event.team_id,
            meta: event.meta !== null ? event.meta : Prisma.DbNull
        }
    });

};
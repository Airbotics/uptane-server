import { EAktualizrEvent } from "@airbotics-core/consts";
import { prisma } from "@airbotics-core/drivers";
import { logger } from "@airbotics-core/logger";
import { EcuStatus } from "@prisma/client";
import { AktualizrEvent, aktualizrEvent } from ".";


//Rollout event handler
export const rolloutEventHandler = ((event: AktualizrEvent) => {

    switch (event.eventType.id) {
        case EAktualizrEvent.CampaignAccepted: handleRolloutAccepted(event); break;
        case EAktualizrEvent.CampaignDeclined: handleRolloutDeclined(event); break;
        case EAktualizrEvent.CampaignPostponed: handleRolloutPostponed(event); break;
        case EAktualizrEvent.DevicePaused: handleRobotPaused(event); break;
        case EAktualizrEvent.DeviceResumed: handleRobotResumed(event); break;
        case EAktualizrEvent.EcuDownloadStarted: handleEcuEvent(event, EcuStatus.download_started); break;
        case EAktualizrEvent.EcuDownloadCompleted: handleEcuEvent(event, event.event.success ? EcuStatus.download_completed : EcuStatus.download_failed); break;
        case EAktualizrEvent.EcuInstallationStarted: handleEcuEvent(event, EcuStatus.installation_started); break;
        case EAktualizrEvent.EcuInstallationApplied: handleEcuEvent(event, EcuStatus.installation_applied); break;
        case EAktualizrEvent.EcuInstallationCompleted: handleEcuEvent(event, event.event.success ? EcuStatus.installation_completed : EcuStatus.installation_failed); break;
        default: logger.error(`unable to handle AktualizrEvent. No handler for event type ${event.eventType.id}`)
    }    
});


const handleRolloutAccepted = (event: AktualizrEvent) => {
    logger.info(`handling AktualizrEvent: ${event.eventType.id}`);
} 

const handleRolloutDeclined = (event: AktualizrEvent) => {
    logger.info(`handling AktualizrEvent: ${event.eventType.id}`);
} 

const handleRolloutPostponed = (event: AktualizrEvent) => {
    logger.info(`handling AktualizrEvent: ${event.eventType.id}`);
} 

const handleRobotPaused = (event: AktualizrEvent) => {
    logger.info(`TODO: handling AktualizrEvent: ${event.eventType.id}`);
} 

const handleRobotResumed = (event: AktualizrEvent) => {
    logger.info(`TODO: handling AktualizrEvent: ${event.eventType.id}`);
}

/**
 * Update the ecu status in the RolloutRobotEcu table AND
 * the Ecu itself to make it easier to quickly glance at the fleet health
 * 
 * The correlationId is the RolloutRobot id which is included as a custom field
 * in the director targets.json during rollout processing
 */
const handleEcuEvent = async (event: AktualizrEvent, status: EcuStatus) => {

    logger.info(`handling AktualizrEvent: ${event.eventType.id}`);

    if(event.event.correlationId === null || event.event.ecu === null) {
        logger.error(`Could not process ${event.eventType.id} event, ecu or correlation ID is missing!`);
        return;
    }

    await prisma.$transaction(async tx => {

        await tx.rolloutRobotEcu.update({
            where: {
                rollout_robot_id_ecu_id: {
                    rollout_robot_id: event.event.correlationId!,
                    ecu_id: event.event.ecu!
                }
            },
            data: {
                status: status
            }
        });

        await tx.ecu.update({
            where: { id: event.event.ecu! },
            data: {
                status: status
            }
        })

    })

}
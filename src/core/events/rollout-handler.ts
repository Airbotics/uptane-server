import { EcuStatus } from '@prisma/client';
import { EAktualizrEvent } from '@airbotics-core/consts';
import { prisma } from '@airbotics-core/drivers';
import { logger } from '@airbotics-core/logger';
import { AktualizrEvent } from '.';


//Rollout event handler
export const rolloutEventHandler = async (event: AktualizrEvent) => {

    switch (event.eventType.id) {
        case EAktualizrEvent.CampaignAccepted: await handleRolloutAccepted(event); break;
        case EAktualizrEvent.CampaignDeclined: await handleRolloutDeclined(event); break;
        case EAktualizrEvent.CampaignPostponed: await handleRolloutPostponed(event); break;
        case EAktualizrEvent.DevicePaused: await handleRobotPaused(event); break;
        case EAktualizrEvent.DeviceResumed: await handleRobotResumed(event); break;
        case EAktualizrEvent.EcuDownloadStarted: await handleEcuEvent(event, EcuStatus.download_started); break;
        case EAktualizrEvent.EcuDownloadCompleted: await handleEcuEvent(event, event.event.success ? EcuStatus.download_completed : EcuStatus.download_failed); break;
        case EAktualizrEvent.EcuInstallationStarted: await handleEcuEvent(event, EcuStatus.installation_started); break;
        case EAktualizrEvent.EcuInstallationApplied: await handleEcuEvent(event, EcuStatus.installation_applied); break;
        case EAktualizrEvent.EcuInstallationCompleted: await handleEcuEvent(event, event.event.success ? EcuStatus.installation_completed : EcuStatus.installation_failed); break;
        default: logger.error(`unable to handle AktualizrEvent. No handler for event type ${event.eventType.id}`);
    }
};


const handleRolloutAccepted = async (event: AktualizrEvent) => {
    logger.info(`handling AktualizrEvent: ${event.eventType.id}`);
}

const handleRolloutDeclined = async (event: AktualizrEvent) => {
    logger.info(`handling AktualizrEvent: ${event.eventType.id}`);
}

const handleRolloutPostponed = async (event: AktualizrEvent) => {
    logger.info(`handling AktualizrEvent: ${event.eventType.id}`);
}

const handleRobotPaused = async (event: AktualizrEvent) => {
    logger.info(`TODO: handling AktualizrEvent: ${event.eventType.id}`);
}

const handleRobotResumed = async (event: AktualizrEvent) => {
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

    if (event.event.correlationId === null || event.event.ecu === null) {
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

        //update the ecu status to whats being reported
        const updatedEcu = await tx.ecu.update({
            where: { id: event.event.ecu! },
            data: {
                status: status,
            }
        });

        //We also need to update the 'installed image' of the ecu
        if (event.eventType.id === EAktualizrEvent.EcuInstallationCompleted) {

            const botRollout = await prisma.rolloutRobot.findUnique({
                where: { id: event.event.correlationId! },
                include: {
                    rollout: {
                        include: { hw_imgs: true }
                    }
                }
            });

            await tx.ecu.update({
                where: { id: event.event.ecu! },
                data: {
                    image_id: botRollout?.rollout.hw_imgs.find(hw_img => hw_img.hw_id === updatedEcu.hwid )!.image_id
                }
            });

        }
    })

}
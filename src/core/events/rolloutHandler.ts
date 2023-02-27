import { EAktualizrEvent } from "@airbotics-core/consts";
import { logger } from "@airbotics-core/logger";
import { AktualizrEvent, aktualizrEvent } from ".";


//Rollout event handler
export const rolloutEventHandler = ((event: AktualizrEvent) => {

    switch (event.eventType.id) {
        case EAktualizrEvent.CampaignAccepted: handleRolloutAccepted(event); break;
        case EAktualizrEvent.CampaignDeclined: handleRolloutDeclined(event); break;
        case EAktualizrEvent.CampaignPostponed: handleRolloutPostponed(event); break;
        case EAktualizrEvent.DevicePaused: handleRobotPaused(event); break;
        case EAktualizrEvent.DeviceResumed: handleRobotResumed(event); break;
        case EAktualizrEvent.EcuDownloadStarted: handleEcuDownloadStarted(event); break;
        case EAktualizrEvent.EcuDownloadCompleted: handleEcuDownloadCompleted(event); break;
        case EAktualizrEvent.EcuInstallationStarted: handleEcuInstallationStarted(event); break;
        case EAktualizrEvent.EcuInstallationApplied: handleEcuInstallationApplied(event); break;
        case EAktualizrEvent.EcuInstallationCompleted: handleEcuInstallationCompleted(event); break;
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

// ecu has started a download attempt for an image
const handleEcuDownloadStarted = (event: AktualizrEvent) => {
    logger.info(`TODO: handling AktualizrEvent: ${event.eventType.id}`);
} 

// ecu has finished a download attempt for an image, may or may not be successful
const handleEcuDownloadCompleted = (event: AktualizrEvent) => {
    logger.info(`TODO: handling AktualizrEvent: ${event.eventType.id}`);
} 

// ecu has started to try and install the successfully downloaded image
const handleEcuInstallationStarted = (event: AktualizrEvent) => {
    logger.info(`TODO: handling AktualizrEvent: ${event.eventType.id}`);
} 

// ecu is happy with the image but may need a reboot to complete the update
const handleEcuInstallationApplied = (event: AktualizrEvent) => {
    logger.info(`TODO: handling AktualizrEvent: ${event.eventType.id}`);
} 

// ecu has rebooted if necessary and update is confirmed as running
const handleEcuInstallationCompleted = (event: AktualizrEvent) => {
    logger.info(`TODO: handling AktualizrEvent: ${event.eventType.id}`);
    logger.info(`TODO: handling AktualizrEvent: ${event}`);
}
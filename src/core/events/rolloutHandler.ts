import { EAktualizrEvent } from "@airbotics-core/consts";
import { logger } from "@airbotics-core/logger";
import { AktualizrEvent, aktualizrEvent } from ".";

//Rollout event handler
aktualizrEvent.addListener((event: AktualizrEvent) => {
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
    logger.info(`handling AktualizrEvent: ${event.eventType.id}`);
} 

const handleRobotResumed = (event: AktualizrEvent) => {
    logger.info(`handling AktualizrEvent: ${event.eventType.id}`);
}

const handleEcuDownloadStarted = (event: AktualizrEvent) => {
    logger.info(`handling AktualizrEvent: ${event.eventType.id}`);
} 

const handleEcuDownloadCompleted = (event: AktualizrEvent) => {
    logger.info(`handling AktualizrEvent: ${event.eventType.id}`);
} 

const handleEcuInstallationStarted = (event: AktualizrEvent) => {
    logger.info(`handling AktualizrEvent: ${event.eventType.id}`);
} 

const handleEcuInstallationApplied = (event: AktualizrEvent) => {
    logger.info(`handling AktualizrEvent: ${event.eventType.id}`);
} 

const handleEcuInstallationCompleted = (event: AktualizrEvent) => {
    logger.info(`handling AktualizrEvent: ${event.eventType.id}`);
} 
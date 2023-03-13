import { logger } from '@airbotics-core/logger';
import { certificateManager } from '@airbotics-core/crypto/certificates';

/**
 * Purge provisioning credentials.
 */
export const purgeExpiredProvisioningCredentials = async () => {

    logger.info('running background worker to purge expired provisioning credentials');

    try {
        await certificateManager.purgeExpiredCertificates();
    } catch (error) {
        console.log(error);
    }

    logger.info('completed background worker to purge expired provisioning credentials');

}
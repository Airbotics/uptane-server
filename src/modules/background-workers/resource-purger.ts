import { logger } from '@airbotics-core/logger';

/**
 * Purges resources
 */
export const resourcePurger = async () => {

    logger.info('running background worker to purge resources');

    // TODO implement

    /**
     * pop one resource from the trash, then delete the resource, then delete the item from the trash and gracefully exit
     */

    logger.info('completed background worker to purge resources');

}
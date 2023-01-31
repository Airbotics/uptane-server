import express, { Request, Response } from 'express';
import { logger } from '@airbotics-core/logger';
import { airEvent } from '@airbotics-core/events';
import { EEventAction, EEventActorType, EEventResource } from '@airbotics-core/consts';

const router = express.Router();


/**
 * A user has registered.
 */
router.post('/incoming-webhooks/after-registration', express.raw({ type: '*/*' }), async (req: Request, res: Response) => {

    airEvent.emit({
        resource: EEventResource.Account,
        action: EEventAction.Created,
        actor_type: EEventActorType.User,
        actor_id: req.oryIdentity!.traits.id,
        team_id: null,
        meta: null
    });

    logger.info('a user has registered an account');
    return res.status(200).end();
});

/**
 * A user has verified their account.
 */
router.post('/incoming-webhooks/after-verification', express.raw({ type: '*/*' }), async (req: Request, res: Response) => {

    airEvent.emit({
        resource: EEventResource.Account,
        action: EEventAction.Verified,
        actor_type: EEventActorType.User,
        actor_id: req.oryIdentity!.traits.id,
        team_id: null,
        meta: null
    });

    logger.info('a user has verified their account');
    return res.status(200).end();
});


/**
 * A user has logged in.
 */
router.post('/incoming-webhooks/after-login', express.raw({ type: '*/*' }), async (req: Request, res: Response) => {

    airEvent.emit({
        resource: EEventResource.Account,
        action: EEventAction.LoggedIn,
        actor_type: EEventActorType.User,
        actor_id: req.oryIdentity!.traits.id,
        team_id: null,
        meta: null
    });

    logger.info('a user has logged into their account');
    return res.status(200).end();
});

/**
 * A user starts to recover their password.
 */
router.post('/incoming-webhooks/before-recovery', express.raw({ type: '*/*' }), async (req: Request, res: Response) => {

    airEvent.emit({
        resource: EEventResource.Account,
        action: EEventAction.AccountRecoveredStarted,
        actor_type: EEventActorType.User,
        actor_id: req.oryIdentity!.traits.id,
        team_id: null,
        meta: null
    });

    logger.info('a user has started to recover their account');
    return res.status(200).end();
});

/**
 * A user has recovered their password.
 */
router.post('/incoming-webhooks/after-recovery', express.raw({ type: '*/*' }), async (req: Request, res: Response) => {

    airEvent.emit({
        resource: EEventResource.Account,
        action: EEventAction.AccountRecoveredFinished,
        actor_type: EEventActorType.User,
        actor_id: req.oryIdentity!.traits.id,
        team_id: null,
        meta: null
    });

    logger.info('a user has recovered their account');
    return res.status(200).end();
});


export default router;
import { EValidationSource, OryTeamRelations } from '@airbotics-core/consts';
import express, { Request } from 'express';
import { mustBeAuthenticated, mustBeInTeam, validate } from '@airbotics-middlewares';
import * as controller from './controller';
import { createRolloutSchema, rolloutIdSchema } from '../schemas';

const router = express.Router();


// create a rollout
router.post('/rollouts',
    mustBeAuthenticated,
    mustBeInTeam(OryTeamRelations.admin),
    validate(createRolloutSchema, EValidationSource.Body),
    controller.createRollout);


// list rollouts
router.get('/rollouts',
    mustBeAuthenticated,
    mustBeInTeam(OryTeamRelations.admin),
    controller.listRollouts);


//launch a rollout
router.post('/rollouts/:rollout_id/launch',
    mustBeAuthenticated,
    mustBeInTeam(OryTeamRelations.admin),
    controller.launchRollout);


// get rollout detail
router.get('/rollouts/:rollout_id',
    mustBeAuthenticated,
    mustBeInTeam(OryTeamRelations.admin),
    validate(rolloutIdSchema, EValidationSource.Path),
    controller.getRollout);
    

export default router;
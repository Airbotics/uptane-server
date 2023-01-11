import { OryTeamRelations } from '@airbotics-core/consts';
import express, { Request } from 'express';

import { mustBeAuthenticated, mustBeInTeam } from 'src/middlewares';

import * as controller from './controller';

const router = express.Router();


//create a rollout
router.post('/rollouts',
    mustBeAuthenticated,
    mustBeInTeam(OryTeamRelations.admin),
    controller.createRollout);

    
export default router;
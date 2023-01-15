import { OryTeamRelations } from '@airbotics-core/consts';
import express, { Request } from 'express';
import { mustBeAuthenticated, mustBeInTeam } from '@airbotics-middlewares';
import * as controller from './controller';

const router = express.Router();


// create a rollout
router.post('/rollouts',
    mustBeAuthenticated,
    mustBeInTeam(OryTeamRelations.admin),
    controller.createRollout);

// list rollouts
// TODO
router.get('/rollouts', (req,res) => res.end());

// get rollout detail
// TODO
router.get('/rollouts/:rollout_id', (req,res) => res.end());

    
export default router;
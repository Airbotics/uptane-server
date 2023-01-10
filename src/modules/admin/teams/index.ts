import { OryTeamRelations } from '@airbotics-core/consts';
import express, { Request } from 'express';
import { mustBeAuthenticated, mustBeInTeam } from 'src/middlewares';
import * as controller from './controller';

const router = express.Router();

//delete team
router.delete('/',
    mustBeAuthenticated,
    mustBeInTeam(OryTeamRelations.admin),
    controller.deleteTeam);

export default router;
import { OryTeamRelations } from '@airbotics-core/consts';
import express, { Request } from 'express';
import { mustBeAuthenticated, mustBeInTeam } from '@airbotics-middlewares';
import * as controller from './controller';

const router = express.Router();


// create provisioning credentials
router.post('/provisioning-credentials',
    mustBeAuthenticated,
    mustBeInTeam(OryTeamRelations.admin),
    controller.createProvisioningCredentials);

// list provisioning credentials
router.get('/provisioning-credentials',
    mustBeAuthenticated,
    mustBeInTeam(OryTeamRelations.admin),
    controller.listProvisioningCredentials);

export default router;
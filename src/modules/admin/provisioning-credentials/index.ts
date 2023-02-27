import { EValidationSource, OryTeamRelations } from '@airbotics-core/consts';
import express, { Request } from 'express';
import { mustBeAuthenticated, mustBeInTeam, validate } from '@airbotics-middlewares';
import * as controller from './controller';
import { imageIdSchema, provCredentialsSchema } from '../schemas';

const router = express.Router();


// create provisioning credentials
router.post('/provisioning-credentials',
    mustBeAuthenticated,
    mustBeInTeam(OryTeamRelations.admin),
    // validate(provCredentialsSchema, EValidationSource.Body),
    controller.createProvisioningCredentials);

// get a provisioning credential
// router.get('/provisioning-credentials/:id',
//     mustBeAuthenticated,
//     mustBeInTeam(OryTeamRelations.admin),
//     controller.downloadProvisioningCredential);

// list provisioning credentials
router.get('/provisioning-credentials',
    mustBeAuthenticated,
    mustBeInTeam(OryTeamRelations.admin),
    controller.listProvisioningCredentials);


export default router;
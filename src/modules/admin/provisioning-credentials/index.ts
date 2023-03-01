import { EValidationSource, OryTeamRelations } from '@airbotics-core/consts';
import express, { Request } from 'express';
import { mustBeAuthenticated, mustBeInTeam, validate } from '@airbotics-middlewares';
import * as controller from './controller';
import { imageIdSchema, provCredentialsSchema, provsioningCredentialsIdSchema } from '../schemas';

const router = express.Router();


// create provisioning credentials
router.post('/provisioning-credentials',
    mustBeAuthenticated,
    mustBeInTeam(OryTeamRelations.admin),
    validate(provCredentialsSchema, EValidationSource.Body),
    controller.createProvisioningCredentials);

// get a provisioning credential
router.get('/provisioning-credentials/:credentials_id',
    mustBeAuthenticated,
    mustBeInTeam(OryTeamRelations.admin),
    validate(provsioningCredentialsIdSchema, EValidationSource.Path),
    controller.downloadProvisioningCredential);

// list provisioning credentials
router.get('/provisioning-credentials',
    mustBeAuthenticated,
    mustBeInTeam(OryTeamRelations.admin),
    controller.listProvisioningCredentials);

// revoke a provisioning credential
router.delete('/provisioning-credentials/:credentials_id',
    mustBeAuthenticated,
    mustBeInTeam(OryTeamRelations.admin),
    validate(provsioningCredentialsIdSchema, EValidationSource.Path),
    controller.revokeProvisioningCredentials);


export default router;
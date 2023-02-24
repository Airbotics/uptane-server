import express from 'express';
import { mustBeAuthenticated, validate } from '@airbotics-middlewares';
import * as controller from './controller';
import { EValidationSource } from '@airbotics-core/consts';
import { updateAccountSchema } from '../schemas';

const router = express.Router();

// update account details
router.put('/account',
    mustBeAuthenticated,
    validate(updateAccountSchema, EValidationSource.Body),
    controller.updateAccount);

// delete a users account
router.delete('/account',
    mustBeAuthenticated,
    controller.deleteAccount);

export default router;
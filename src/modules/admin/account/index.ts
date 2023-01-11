import express, { Request } from 'express';
import { mustBeAuthenticated, mustBeInTeam } from 'src/middlewares';
import * as controller from './controller';

const router = express.Router();

//update account details
router.put('/account',
    mustBeAuthenticated,
    controller.updateAccount);

export default router;
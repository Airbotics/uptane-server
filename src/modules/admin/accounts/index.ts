import express, { Request } from 'express';
import { mustBeAuthenticated, mustBeInTeam } from 'src/middlewares';
import * as controller from './controller';

const router = express.Router();

//update account details
router.put('/',
    mustBeAuthenticated,
    controller.updateAccount);

export default router;
import { OryTeamRelations } from '@airbotics-core/consts';
import express, { Request } from 'express';
import { mustBeAuthenticated, mustBeInTeam } from '@airbotics-middlewares';
import * as controller from './controller';

const router = express.Router();

//create an image
router.post('/images',
    express.raw({ type: '*/*' }),
    mustBeAuthenticated,
    mustBeInTeam(OryTeamRelations.admin),
    controller.createImage);

    
//list images
router.get('/images',
    mustBeAuthenticated,
    mustBeInTeam(OryTeamRelations.member),
    controller.listImages);

export default router;
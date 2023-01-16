import { OryTeamRelations } from '@airbotics-core/consts';
import express, { Request } from 'express';
import { mustBeAuthenticated, mustBeInTeam } from '@airbotics-middlewares';
import * as controller from './controller';

const router = express.Router();

// list images
router.get('/images',
    mustBeAuthenticated,
    mustBeInTeam(OryTeamRelations.member),
    controller.listImages);

// get single image
router.get('/images/:image_id',
    mustBeAuthenticated,
    mustBeInTeam(OryTeamRelations.member),
    controller.getImage);

export default router;
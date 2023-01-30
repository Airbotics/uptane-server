import { EValidationSource, OryTeamRelations } from '@airbotics-core/consts';
import express from 'express';
import { mustBeAuthenticated, mustBeInTeam, validate } from '@airbotics-middlewares';
import * as controller from './controller';
import { imageIdSchema } from '../schemas';

const router = express.Router();

// list images
router.get('/images',
    mustBeAuthenticated,
    mustBeInTeam(OryTeamRelations.admin),
    controller.listImages);

// get single image
router.get('/images/:image_id',
    mustBeAuthenticated,
    mustBeInTeam(OryTeamRelations.admin),
    validate(imageIdSchema, EValidationSource.Path),
    controller.getImage);

export default router;
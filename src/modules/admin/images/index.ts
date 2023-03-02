import { EValidationSource, OryTeamRelations } from '@airbotics-core/consts';
import express from 'express';
import { mustBeAuthenticated, mustBeInTeam, validate } from '@airbotics-middlewares';
import * as controller from './controller';
import { imageIdSchema, updateImageDetailsSchema } from '../schemas';

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

// update image details
router.patch('/images/:image_id',
    mustBeAuthenticated,
    mustBeInTeam(OryTeamRelations.admin),
    validate(imageIdSchema, EValidationSource.Path),
    validate(updateImageDetailsSchema, EValidationSource.Body),
    controller.updateImageDetails);

// get all robots that have image installed
router.get('/images/:image_id/robots',
    mustBeAuthenticated,
    mustBeInTeam(OryTeamRelations.admin),
    validate(imageIdSchema, EValidationSource.Path),
    controller.listRobotsWithImage);

export default router;
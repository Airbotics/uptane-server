import { EValidationSource, OryTeamRelations } from '@airbotics-core/consts';
import express from 'express';
import { mustBeAuthenticated, mustBeInTeam, validate } from '@airbotics-middlewares';
import * as controller from './controller';
import { robotIdSchema } from '../schemas';

const router = express.Router();


//list robots
router.get('/robots',
    mustBeAuthenticated,
    mustBeInTeam(OryTeamRelations.member),
    controller.listRobots);

//get robot details
router.get('/robots/:robot_id',
    mustBeAuthenticated,
    mustBeInTeam(OryTeamRelations.member),
    validate(robotIdSchema, EValidationSource.Path),
    controller.getRobot);

//delete robot
router.delete('/robots/:robot_id',
    mustBeAuthenticated,
    mustBeInTeam(OryTeamRelations.admin),
    controller.deleteRobot);

//list groups robot is in
router.get('/robots/:robot_id/groups',
    mustBeAuthenticated,
    mustBeInTeam(OryTeamRelations.member),
    validate(robotIdSchema, EValidationSource.Path),
    controller.listRobotGroups);

//list a robots rollouts
router.get('/robots/:robot_id/rollouts',
    mustBeAuthenticated,
    mustBeInTeam(OryTeamRelations.member),
    validate(robotIdSchema, EValidationSource.Path),
    controller.listRobotRollouts);

//list a robots telemetry
router.get('/robots/:robot_id/telemetry',
    mustBeAuthenticated,
    mustBeInTeam(OryTeamRelations.member),
    validate(robotIdSchema, EValidationSource.Path),
    controller.listRobotTelemetry);


export default router;
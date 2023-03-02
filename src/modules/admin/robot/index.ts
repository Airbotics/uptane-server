import { EValidationSource, OryTeamRelations } from '@airbotics-core/consts';
import express from 'express';
import { mustBeAuthenticated, mustBeInTeam, validate } from '@airbotics-middlewares';
import * as controller from './controller';
import { robotIdSchema, updateRobotDetailsSchema } from '../schemas';

const router = express.Router();


//list robots
router.get('/robots',
    mustBeAuthenticated,
    mustBeInTeam(OryTeamRelations.admin),
    controller.listRobots);

//get robot details
router.get('/robots/:robot_id',
    mustBeAuthenticated,
    mustBeInTeam(OryTeamRelations.admin),
    validate(robotIdSchema, EValidationSource.Path),
    controller.getRobot);

//update robot details
router.patch('/robots/:robot_id',
    mustBeAuthenticated,
    mustBeInTeam(OryTeamRelations.admin),
    validate(robotIdSchema, EValidationSource.Path),
    validate(updateRobotDetailsSchema, EValidationSource.Body),
    controller.updateRobotDetails);

//delete robot
router.delete('/robots/:robot_id',
    mustBeAuthenticated,
    mustBeInTeam(OryTeamRelations.admin),
    validate(robotIdSchema, EValidationSource.Path),
    controller.deleteRobot);

//list groups robot is in
router.get('/robots/:robot_id/groups',
    mustBeAuthenticated,
    mustBeInTeam(OryTeamRelations.admin),
    validate(robotIdSchema, EValidationSource.Path),
    controller.listRobotGroups);

//list a robots rollouts
router.get('/robots/:robot_id/rollouts',
    mustBeAuthenticated,
    mustBeInTeam(OryTeamRelations.admin),
    validate(robotIdSchema, EValidationSource.Path),
    controller.listRobotRollouts);

//list a robots telemetry
router.get('/robots/:robot_id/telemetry',
    mustBeAuthenticated,
    mustBeInTeam(OryTeamRelations.admin),
    validate(robotIdSchema, EValidationSource.Path),
    controller.listRobotTelemetry);


//delete a robots telemetry
router.delete('/robots/:robot_id/telemetry',
    mustBeAuthenticated,
    mustBeInTeam(OryTeamRelations.admin),
    validate(robotIdSchema, EValidationSource.Path),
    controller.deleteRobotTelemetry);


export default router;
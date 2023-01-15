import { OryTeamRelations } from '@airbotics-core/consts';
import express, { Request } from 'express';
import { mustBeAuthenticated, mustBeInTeam } from '@airbotics-middlewares';
import * as controller from './controller';

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
    controller.listRobotGroups);

export default router;
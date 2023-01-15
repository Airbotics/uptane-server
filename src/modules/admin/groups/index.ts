import { OryTeamRelations } from '@airbotics-core/consts';
import express from 'express';
import { mustBeAuthenticated, mustBeInTeam } from '@airbotics-middlewares';
import * as controller from './controller';

const router = express.Router();

//create a group
router.post('/groups',
    mustBeAuthenticated,
    mustBeInTeam(OryTeamRelations.member),
    controller.createGroup);

//list groups
router.get('/groups',
    mustBeAuthenticated,
    mustBeInTeam(OryTeamRelations.member),
    controller.listGroups);

//get group details   
router.get('/groups/:group_id',
    mustBeAuthenticated,
    mustBeInTeam(OryTeamRelations.member),
    controller.getGroup);

//update group details
router.patch('/groups/:group_id',
    mustBeAuthenticated,
    mustBeInTeam(OryTeamRelations.member),
    controller.updateGroup);

//delete a group
router.delete('/groups/:group_id',
    mustBeAuthenticated,
    mustBeInTeam(OryTeamRelations.admin),
    controller.deleteGroup);

//list robots in a group
router.get('/groups/:group_id/robots',
    mustBeAuthenticated,
    mustBeInTeam(OryTeamRelations.member),
    controller.listRobotsInGroup);

//add a robot to a group
router.post('/groups/:group_id/robots',
    mustBeAuthenticated,
    mustBeInTeam(OryTeamRelations.member),
    controller.addRobotToGroup);

//remove robot from group
router.delete('/groups/:group_id/robots',
    mustBeAuthenticated,
    mustBeAuthenticated,
    mustBeInTeam(OryTeamRelations.admin),
    controller.removeRobotFromGroup);



    
export default router;
import express from 'express';
import { EValidationSource, OryTeamRelations } from '@airbotics-core/consts';
import { mustBeAuthenticated, mustBeInTeam, validate } from '@airbotics-middlewares';
import * as controller from './controller';
import { createGroupSchema, groupIdSchema, robotIdSchema, updateGoupSchema } from '../schemas';

const router = express.Router();

// create a group
router.post('/groups',
    mustBeAuthenticated,
    mustBeInTeam(OryTeamRelations.member),
    validate(createGroupSchema, EValidationSource.Body),
    controller.createGroup);

// list groups
router.get('/groups',
    mustBeAuthenticated,
    mustBeInTeam(OryTeamRelations.member),
    controller.listGroups);

// get group details   
router.get('/groups/:group_id',
    mustBeAuthenticated,
    mustBeInTeam(OryTeamRelations.member),
    validate(groupIdSchema, EValidationSource.Path),
    controller.getGroup);

// update group details
router.patch('/groups/:group_id',
    mustBeAuthenticated,
    mustBeInTeam(OryTeamRelations.member),
    validate(groupIdSchema, EValidationSource.Path),
    validate(updateGoupSchema, EValidationSource.Body),
    controller.updateGroup);

// delete a group
router.delete('/groups/:group_id',
    mustBeAuthenticated,
    mustBeInTeam(OryTeamRelations.admin),
    validate(groupIdSchema, EValidationSource.Path),
    controller.deleteGroup);

// list robots in a group
router.get('/groups/:group_id/robots',
    mustBeAuthenticated,
    mustBeInTeam(OryTeamRelations.member),
    validate(groupIdSchema, EValidationSource.Path),
    controller.listRobotsInGroup);

// add a robot to a group
router.post('/groups/:group_id/robots',
    mustBeAuthenticated,
    mustBeInTeam(OryTeamRelations.member),
    validate(groupIdSchema, EValidationSource.Path),
    validate(robotIdSchema, EValidationSource.Body),
    controller.addRobotToGroup);

// remove robot from group
router.delete('/groups/:group_id/robots',
    mustBeAuthenticated,
    mustBeInTeam(OryTeamRelations.admin),
    validate(groupIdSchema, EValidationSource.Path),
    validate(robotIdSchema, EValidationSource.Body),
    controller.removeRobotFromGroup);


export default router;
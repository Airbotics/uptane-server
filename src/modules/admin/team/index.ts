import { EValidationSource, OryTeamRelations } from '@airbotics-core/consts';
import express, { Request } from 'express';
import { mustBeAuthenticated, mustBeInTeam, validate } from '@airbotics-middlewares';
import * as controller from './controller';
import { createTeamSchema } from '../schemas';

const router = express.Router();

//create team
router.post('/teams',
    mustBeAuthenticated,
    validate(createTeamSchema, EValidationSource.Body),
    controller.createTeam);

//list teams
router.get('/teams',
    mustBeAuthenticated,
    controller.listTeams);

//update team
router.patch('/teams',
    mustBeAuthenticated,
    mustBeInTeam(OryTeamRelations.admin),
    controller.updateTeam);

// delete team
router.delete('/teams',
    mustBeAuthenticated,
    mustBeInTeam(OryTeamRelations.admin),
    controller.deleteTeam);

//list team members
router.get('/teams/members',
    mustBeAuthenticated,
    mustBeInTeam(OryTeamRelations.admin),
    controller.listTeamMembers);

// remove member from team
router.delete('/teams/members/:member_id',
    mustBeAuthenticated,
    mustBeInTeam(OryTeamRelations.admin),
    controller.deleteTeamMembers);
    
// get fleet stats
router.get('/fleet-overview',
    mustBeAuthenticated,
    mustBeInTeam(OryTeamRelations.admin),
    controller.getFleetOverview);

/*
//list a team invites
router.get('/team/invites',
    mustBeAuthenticated,
    mustBeInTeam(OryTeamRelations.admin),
    controller.createTeam);


//create a team invite
router.post('/team/invites',
    mustBeAuthenticated,
    mustBeInTeam(OryTeamRelations.admin),
    controller.createTeam);

//create a team invite
router.post('/team/invites/:invite_id',
    mustBeAuthenticated,
    mustBeInTeam(OryTeamRelations.admin),
    controller.createTeam);

//revoke a team invite
router.delete('/team/invites/:invite_id',
    mustBeAuthenticated,
    mustBeInTeam(OryTeamRelations.admin),
    controller.createTeam);

//accept/reject a team invite
router.post('/team/invites/confirm/:invite_id',
    mustBeAuthenticated,
    controller.createTeam);

//leave a team
router.put('/team/leave',
    mustBeAuthenticated,
    mustBeInTeam(OryTeamRelations.admin),
    controller.createTeam);
*/

export default router;
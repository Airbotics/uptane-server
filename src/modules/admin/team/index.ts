import { OryTeamRelations } from '@airbotics-core/consts';
import express, { Request } from 'express';

import { mustBeAuthenticated, mustBeInTeam } from 'src/middlewares';

import * as controller from './controller';

const router = express.Router();

//create team
router.post('/teams',
    mustBeAuthenticated,
    controller.createTeam);

//list teams
router.get('/teams',
    mustBeAuthenticated,
    mustBeInTeam(OryTeamRelations.member),
    controller.listTeams);

//update team
router.patch('/teams',
    mustBeAuthenticated,
    mustBeInTeam(OryTeamRelations.admin),
    controller.updateTeam);


//list team members
router.get('/teams/members',
    mustBeAuthenticated,
    mustBeInTeam(OryTeamRelations.member),
    controller.listTeamMembers);


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
    mustBeInTeam(OryTeamRelations.member),
    controller.createTeam);
*/

export default router;
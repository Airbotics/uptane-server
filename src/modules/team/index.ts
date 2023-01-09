import { OryTeamRelations } from '@airbotics-core/consts';
import express, { Request } from 'express';

import { mustBeAuthenticated, mustBeInTeam } from 'src/middlewares';

import * as controller from './controller';

const router = express.Router();

//create team
router.post('/',
    mustBeAuthenticated,
    controller.createTeam);

//list teams
router.get('/',
    mustBeAuthenticated,
    mustBeInTeam(OryTeamRelations.member),
    controller.listTeams);

//update team
router.patch('/',
    mustBeAuthenticated,
    mustBeInTeam(OryTeamRelations.admin),
    controller.updateTeam);


//list team members
router.get('/members',
    mustBeAuthenticated,
    mustBeInTeam(OryTeamRelations.member),
    controller.listTeamMembers);


//list a team invites
router.get('/invites',
    mustBeAuthenticated,
    mustBeInTeam(OryTeamRelations.admin),
    controller.createTeam);


//create a team invite
router.post('/invites',
    mustBeAuthenticated,
    mustBeInTeam(OryTeamRelations.admin),
    controller.createTeam);

//create a team invite
router.post('/invites/:invite_id',
    mustBeAuthenticated,
    mustBeInTeam(OryTeamRelations.admin),
    controller.createTeam);

//revoke a team invite
router.delete('/invites/:invite_id',
    mustBeAuthenticated,
    mustBeInTeam(OryTeamRelations.admin),
    controller.createTeam);

//accept/reject a team invite
router.post('/invites/confirm/:invite_id',
    mustBeAuthenticated,
    controller.createTeam);

//leave a team
router.put('/leave',
    mustBeAuthenticated,
    mustBeInTeam(OryTeamRelations.member),
    controller.createTeam);





export default router;



import express from 'express';
import account from './account';
import image from './image';
import provision from './provision';
import robot from './robot';
import rollout from './rollout';
import team from './team';
import groups from './groups';

const router = express.Router();

router.use(account, image, provision, robot, rollout, team, groups);


export default router;
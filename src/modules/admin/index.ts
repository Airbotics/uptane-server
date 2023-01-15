import express from 'express';
import account from './account';
import image from './image';
import provision from './provision';
import robot from './robot';
import rollout from './rollout';
import team from './team';

const router = express.Router();

router.use(account, image, provision, robot, rollout, team);


export default router;
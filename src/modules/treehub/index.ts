import express from 'express';
import config from './config';
import objects from './objects';
import refs from './refs';
import summary from './summary';
import deltas from './deltas';

const router = express.Router();

router.use(config, objects, refs, summary, deltas);


export default router;
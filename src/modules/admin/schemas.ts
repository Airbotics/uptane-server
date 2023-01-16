import Joi from 'joi';

/**
 * fields used in multiple schemas
 */
const nameField = Joi.string().min(2).max(100);
const robotIdField = Joi.string().min(1).max(100);

/**
 * schemas
 */
export const groupIdSchema = Joi.object({
    group_id: Joi.string().uuid().required(),
});

// note: image ids dont have to be uuids
export const imageIdSchema = Joi.object({
    image_id: Joi.string().required(),
});

// note: robot ids dont have to be uuids
export const robotIdSchema = Joi.object({
    robot_id: robotIdField.required(),
});

export const rolloutIdSchema = Joi.object({
    rollout_id: Joi.string().uuid().required(),
});

export const updateAccountSchema = Joi.object({
    first_name: nameField.optional(),
    last_name: nameField.optional()
}).min(1);

export const createGroupSchema = Joi.object({
    name: nameField.required(),
    description: nameField,
    robotIDs: Joi.array().items(robotIdField.required()).min(1).max(100)
});

export const updateGoupSchema = Joi.object({
    name: nameField.optional(),
    description: nameField.optional()
}).min(1);

export const createTeamSchema = Joi.object({
    name: nameField.required(),
});

export const createRolloutSchema = Joi.object({
    ecu_id: Joi.string().required(),
    image_id: Joi.string().required()
});
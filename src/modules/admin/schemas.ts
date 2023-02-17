import { RolloutTargetType } from '@airbotics-core/consts';
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
    robot_ids: Joi.array().items(robotIdField.required()).min(1).max(100)
});

export const updateGoupSchema = Joi.object({
    name: nameField.optional(),
    description: nameField.optional()
}).min(1);

export const createTeamSchema = Joi.object({
    name: nameField.required(),
});

export const createRolloutSchema = Joi.object({
    name: Joi.string().required(),
    description: Joi.string().required(),
    hwid_img_map: Joi.array().items(Joi.object({
        hw_id: Joi.string().required(), 
        img_id: Joi.string().required() 
    })).min(1),
    targeted_robots: Joi.object({
        type: Joi.string().valid(
            RolloutTargetType.group, 
            RolloutTargetType.hw_id_match, 
            RolloutTargetType.selected_bots
        ).required(),
        group_id: Joi.string().allow(''),
        selected_bot_ids: Joi.array().items(Joi.string())
    })
});

export const provCredentialsSchema = Joi.object({
    description: Joi.string().required().min(2),
    expires_at: Joi.number().required().min(new Date().getDate())
});
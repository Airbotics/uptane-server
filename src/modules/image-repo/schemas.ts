import DateExtension from '@joi/date';
import * as JoiImport from 'joi';
import { ESignatureScheme, ETUFRole } from '@airbotics-core/consts';

const Joi = JoiImport.extend(DateExtension);

export const hashschema = Joi.object({
    sha256: Joi.string().required(),
    sha512: Joi.string().optional()
});


export const signatureSchema = Joi.object({
    keyid: Joi.string().required(),
    sig: Joi.string().required(),
    method: Joi.string().valid(ESignatureScheme.RsassaPssSha256).required()
});


export const targetsSchema = Joi.object({
    signatures: Joi.array().items(signatureSchema).required().min(1),
    signed: Joi.object({
        _type: Joi.string().valid(ETUFRole.Targets).required(),
        version: Joi.number().integer().positive().required(),
        expired: Joi.string().required(), //.format('YYYY-MM-DDThh:mm:SS[Z]')
        ecu_version_manifests: Joi.object().pattern(/^/, Joi.object({
            hashes: hashschema.required(),
            length: Joi.number().integer().positive().required(),
            custom: Joi.object({
                cliUploaded: Joi.boolean().required(),
                name: Joi.string().required(),
                version: Joi.string().required(),
                hardwareIds: Joi.array().items(Joi.string()).required(),
                targetFormat: Joi.string().valid('OSTREE').required(),
                uri: Joi.string().allow(null),
                createdAt: Joi.string().required(), //.format('YYYY-MM-DDThh:mm:SS[Z]')
                updatedAt: Joi.string().required(), //.format('YYYY-MM-DDThh:mm:SS[Z]')
            }).required()
        })).required()
    }).required()
});
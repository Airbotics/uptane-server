import Joi from 'joi';
import { SignatureMethods } from '../../core/consts';


 export const hashschema = Joi.object({
    sha256: Joi.string().required(),
    sha512: Joi.string().required()
})


export const signautreSchema = Joi.object({
    keyid: Joi.string().required(),
    sig: Joi.string().required(),
    method: Joi.string().valid(SignatureMethods.rsa, SignatureMethods.ed25519).required(),
    hash: hashschema.required()
})


export const ecuVersionReportSchema = Joi.object({
    signatures: Joi.array().items(signautreSchema).required().min(1), //unsure if this needs to be a length 1 array or simply an object for secondary ecus
    signed: Joi.object({
        ecu_serial: Joi.string().required(),
        time: Joi.date().iso(),
        attacks_detected: Joi.string().required().min(0),
        nonce: Joi.string().required(),
        installed_image: Joi.object({
            filename: Joi.string().required(),
            length: Joi.number().required(),
            hashes: hashschema
        })
        
    })
})


export const robotManifestSchema = Joi.object({
    signatures: Joi.array().items(signautreSchema).required().min(1), 
    signed: Joi.object({
        vin: Joi.string().required(),
        primary_ecu_serial: Joi.string().required(),
        ecu_version_reports: Joi.object().pattern(/^/, ecuVersionReportSchema) //Will need to be updated to support multiple version reports
    })
});

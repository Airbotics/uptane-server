import DateExtension from '@joi/date';
import * as JoiImport from 'joi';
import { ESignatureScheme } from '@airbotics-core/consts';

const Joi = JoiImport.extend(DateExtension);

export const hashschema = Joi.object({
    sha256: Joi.string().required(),
    sha512: Joi.string().optional()
});


export const signatureSchema = Joi.object({
    keyid: Joi.string().required(),
    sig: Joi.string().required(),
    method: Joi.string().valid(ESignatureScheme.RsassaPss).required() 
});


export const ecuVersionReportSchema = Joi.object({
    signatures: Joi.array().items(signatureSchema).required().min(1), // unsure if this needs to be a length 1 array or simply an object for secondary ecus
    signed: Joi.object({
        ecu_serial: Joi.string().required(),
        attacks_detected: Joi.string().required().min(0),
        previous_timeserver_time: Joi.string().required(), //.format('YYYY-MM-DDThh:mm:SS[Z]')
        report_counter: Joi.number().required(), 
        timeserver_time: Joi.string().required(), //.format('YYYY-MM-DDThh:mm:SS[Z]')
        installed_image: Joi.object({
            fileinfo: Joi.object({
                hashes: hashschema,
                length: Joi.number().required(),
            }),
            filepath: Joi.string().required(),
        })
        
    })
});

// aktualizr sends an `installation_report` field which we are not concerned with
export const robotManifestSchema = Joi.object({
    signatures: Joi.array().items(signatureSchema).required().min(1), 
    signed: Joi.object({
        primary_ecu_serial: Joi.string().required(),
        ecu_version_manifests: Joi.object().pattern(/^/, ecuVersionReportSchema), // will need to be updated to support multiple version reports
        installation_report: Joi.optional()
    })
});

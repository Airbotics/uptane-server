export const enum ManifestErrors {
    RobotNotFound = 'could not process manifest, the robot does not exist in the inventory db',
    KeyNotLoaded = 'could not process manifest, the public key for one of the ecu version reports could not be loaded',
    InvalidSchema = 'could not process manifest, the manifest schema is not valid',
    MissingPrimaryReport = 'could not process manifest, the manifest is missing an ecu version report from the primary ecu',
    MissingECUReport = 'could not process manifest, the reported number of ecu reports does not match the inventory db',
    UnknownECUReport = 'could not process manifest, received an ecu report that has been registered in the inventory db',
    InvalidSignature = 'could not process manifest, the signature is invalid',
    InvalidReportSignature = 'could not process manifest, one or more of the ecu report signatures are invalid',
    InvalidReportCounter = 'could not process manifest, one or more of the ecu report counter have been sent before',
    ExpiredReport = 'could not process manifest, one or more of the ecu reports have expired',
    AttackIdentified = 'could not process manifest, one or more of the ecu reports includes an identified attack',
}
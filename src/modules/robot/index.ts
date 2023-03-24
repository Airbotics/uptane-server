import { CertificateStatus, CertificateType } from '@prisma/client';
import dayjs, { ManipulateType } from 'dayjs';
import express, { Request } from 'express';
import forge from 'node-forge';
import { logger } from '@airbotics-core/logger';
import { generateKeyPair, certificateManager } from '@airbotics-core/crypto';
import { prisma } from '@airbotics-core/drivers';
import { EKeyType, EAktualizrEvent } from '@airbotics-core/consts';
import { mustBeRobot, updateRobotMeta } from '@airbotics-middlewares';
import config from '@airbotics-config';
import { delay } from '@airbotics-core/utils';
import { aktualizrEvent, AktualizrEvent } from '@airbotics-core/events';
import { InternalServerErrorResponse, SuccessBinaryResponse, SuccessEmptyResponse } from '@airbotics-core/network/responses';


const router = express.Router();


/**
 * A robot is provisioning itself using the provisioning credentials.
 * 
 * - Create the robot in the db.
 * - Generate a p12 and send it back.
 * 
 * NOTE: This is the only endpoint that doesn't use the `mustBeRobot` middleware.
 * Instead it directly pulls out the `air-client-id` header, which for this endpoint only is the
 * id of the credential, for all other endpoints a robot hits it will be the id of the robot
 * 
 * TODO:
 * - handle ttl
 */
router.post('/devices', async (req: Request, res) => {

    const {
        deviceId,
        ttl
    } = req.body;

    // we prefer robot nomenclature over device
    const robotId = deviceId;

    const credentialId = req.header('air-client-id')!;

    // check provisioning credentials exists and is in an issued state
    const credentials = await prisma.provisioningCredentials.findUnique({
        where: {
            id: credentialId
        }
    });

    if(!credentials) {
        logger.error('could not find a provisioning credential');
        return new InternalServerErrorResponse(res);
    }

    if(credentials!.status !== CertificateStatus.issued) {
        logger.error('provisioning credential is not in an issued state');
        return new InternalServerErrorResponse(res);
    }
    

    // check robot is not already provisioned
    const robot = await prisma.robot.findUnique({
        where: {
            team_id_id: {
                team_id: credentials!.team_id,
                id: robotId
            }
        }
    })

    if (robot) {
        logger.warn('could not provision robot because it is already provisioned');
        return res.status(400).json({ code: 'device_already_registered' });
    }

    // create robot
    await prisma.robot.create({
        data: {
            team_id: credentials!.team_id,
            id: robotId,
            name: robotId
        }
    });


    // generate key pair for the cert, this will be thrown away
    const robotKeyPair = generateKeyPair({ keyType: EKeyType.Rsa });

    const certExpiresAt = dayjs().add(config.ROBOT_CERT_TTL[0] as number, config.ROBOT_CERT_TTL[1] as ManipulateType);

    const robotCertId = await certificateManager.issueCertificate(credentials!.team_id, robotKeyPair, CertificateType.robot, robotId, certExpiresAt);


    // patiently wait for acm pca to issue, apologies client...
    // Note: this should be a couple of seconds long, around 5 seconds
    await delay(5000);

    // get robot cert
    const robotCert = await certificateManager.downloadCertificate(credentials!.team_id, robotCertId);

    if (!robotCert) {
        logger.error('could not issue a cert for a robot');
        return new InternalServerErrorResponse(res);
    }

    // get root cert
    const rootCACert = await certificateManager.getRootCertificate();

    if (!rootCACert) {
        logger.error('could not get the root cert');
        return new InternalServerErrorResponse(res);
    }

    // bundle into pcks12, no encryption password set
    const p12 = forge.pkcs12.toPkcs12Asn1(forge.pki.privateKeyFromPem(robotKeyPair.privateKey),
        [forge.pki.certificateFromPem(robotCert.cert), forge.pki.certificateFromPem(rootCACert)],
        null,
        { algorithm: 'aes256' });

    logger.info('robot has provisioned')
    return new SuccessBinaryResponse(res, Buffer.from(forge.asn1.toDer(p12).getBytes(), 'binary'));

});


/**
 * Ingest a hardware info report from a robot.
 * 
 * Note: this is only sent once and never again.
 */
router.put('/system_info', mustBeRobot, updateRobotMeta, async (req: Request, res) => {

    const {
        team_id,
        robot_id
    } = req.robotGatewayPayload!;

    await prisma.hardwareInfoReport.create({
        data: {
            team_id,
            robot_id,
            hardware_info: req.body,
        }
    });

    logger.info('ingested hardware info report');
    return new SuccessEmptyResponse(res);

});


/**
 * Ingest a libaktualizr configuration report from a robot.
 */
router.post('/system_info/config', mustBeRobot, updateRobotMeta, async (req: Request, res) => {

    const {
        team_id,
        robot_id
    } = req.robotGatewayPayload!;

    const aktConfig = req.body;

    await prisma.aktualizrConfigReport.create({
        data: {
            team_id,
            robot_id,
            config: aktConfig
        }
    });

    logger.info('ingested aktualizr config report');
    return new SuccessEmptyResponse(res);

});


/**
 * Ingest a installed package report from a robot.
 */
router.put('/core/installed', mustBeRobot, updateRobotMeta, async (req: Request, res) => {

    const {
        team_id,
        robot_id
    } = req.robotGatewayPayload!;

    const packages = req.body;

    await prisma.installedPackagesReport.create({
        data: {
            team_id,
            robot_id,
            packages: packages,
        }
    });

    logger.info('ingested installed packages report');
    return new SuccessEmptyResponse(res);

});


/**
 * Ingest telemtry events from a robot.
 * 
 * Note: client sends an id which we could use as the id in the db
 */
router.post('/events', mustBeRobot, updateRobotMeta, async (req: Request, res) => {

    const {
        team_id,
        robot_id
    } = req.robotGatewayPayload!;

    const events = req.body as AktualizrEvent[];

    const robotEvents = events.map(robotEvent => ({
        team_id,
        ecu_id: robotEvent.event.ecu!,
        event_type: robotEvent.eventType.id,
        device_time: robotEvent.deviceTime,
        success: robotEvent.event.success
    }));

    await prisma.ecuTelemetry.createMany({
        data: robotEvents
    });

    for (const event of events) {
        aktualizrEvent.emit(event);
    }

    logger.info('ingested robot event');
    return new SuccessEmptyResponse(res);
});


/**
 * Ingest a network info report from a robot.
 */
router.put('/system_info/network', mustBeRobot, updateRobotMeta, async (req: Request, res) => {

    const {
        hostname,
        local_ipv4,
        mac
    } = req.body;

    const {
        team_id,
        robot_id
    } = req.robotGatewayPayload!;

    await prisma.networkReport.create({
        data: {
            team_id,
            robot_id,
            hostname,
            local_ipv4,
            mac
        }
    });

    logger.info('ingested robot network info');
    return new SuccessEmptyResponse(res);
});


export default router;
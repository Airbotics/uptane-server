import express, { Request } from 'express';
import { ManipulateType } from 'dayjs';
import forge from 'node-forge';
import config from '@airbotics-config';
import { dayjs } from '@airbotics-core/time';
import { logger } from '@airbotics-core/logger';
import { generateKeyPair, certificateManager } from '@airbotics-core/crypto';
import { prisma } from '@airbotics-core/drivers';
import { EKeyType } from '@airbotics-core/consts';
import { mustBeRobot, updateRobotMeta } from '@airbotics-middlewares';
import { IRobotEvent } from '@airbotics-types';
import { delay } from '@airbotics-core/utils';
import { CertificateType } from '@prisma/client';

const router = express.Router();


/**
 * A robot is provisioning itself using the provisioning credentials.
 * 
 * - Create the robot in the db.
 * - Generate a p12 and send it back.
 * 
 * NOTE: This is the only endpoint that doesn't use the `mustBeRobot` middleware.
 * Instead it directly pulls out the `air-client-id` header, which for this endpoint only
 * is the team id.
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

    const team_id = req.header('air-client-id')!;

    // check robot is not already provisioned
    const robot = await prisma.robot.findUnique({
        where: {
            team_id_id: {
                team_id,
                id: robotId
            }
        }
    })

    if (robot) {
        logger.warn('could not provision robot because it is already provisioned');
        return res.status(400).json({ code: 'device_already_registered' });
    }

    // generate key pair for the cert, this will be thrown away
    const robotKeyPair = generateKeyPair({ keyType: EKeyType.Rsa });

    const certExpiresAt = dayjs().add(config.ROBOT_CERT_TTL[0] as number, config.ROBOT_CERT_TTL[1] as ManipulateType);

    const robotCertId = await certificateManager.issueCertificate(team_id, robotKeyPair, CertificateType.robot, robotId, certExpiresAt);

    // patiently wait for acm pca to issue, apologies client...
    // TODO plz fix
    await delay(8000);

    // get robot cert
    const robotCert = await certificateManager.downloadCertificate(team_id, robotCertId);

    if (!robotCert) {
        return res.status(500).end();
    }

    // get root cert
    const rootCACert = await certificateManager.getRootCertificate();

    if (!rootCACert) {
        return res.status(500).end();
    }

    // bundle into pcks12, no encryption password set
    const p12 = forge.pkcs12.toPkcs12Asn1(forge.pki.privateKeyFromPem(robotKeyPair.privateKey),
        [forge.pki.certificateFromPem(robotCert.cert), forge.pki.certificateFromPem(rootCACert)],
        null,
        { algorithm: 'aes256' });


    // create robot storing cert serial
    await prisma.robot.create({
        data: {
            team_id,
            id: robotId,
            // cert_serial: robotCert.serial
        }
    });

    logger.info('robot has provisioned')
    return res.status(200).send(Buffer.from(forge.asn1.toDer(p12).getBytes(), 'binary'));

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
    return res.status(200).end();

});


/**
 * Ingest a libaktualizr configuration report from a robot.
 */
router.post('/system_info/config', mustBeRobot, updateRobotMeta, async (req: Request, res) => {

    const {
        team_id,
        robot_id
    } = req.robotGatewayPayload!;

    await prisma.aktualizrConfigReport.create({
        data: {
            team_id,
            robot_id,
            config: req.body,
        }
    });

    logger.info('ingested aktualizr config report');
    return res.status(200).end();

});


/**
 * Ingest a installed package report from a robot.
 */
router.put('/core/installed', mustBeRobot, updateRobotMeta, async (req: Request, res) => {

    const {
        team_id,
        robot_id
    } = req.robotGatewayPayload!;

    await prisma.installedPackagesReport.create({
        data: {
            team_id,
            robot_id,
            packages: req.body,
        }
    });

    logger.info('ingested installed packages report');
    return res.status(200).end();

});


/**
 * Ingest telemtry events from a robot.
 * 
 * Note: client sends an id which we could use as the id in the db
 */
router.post('/events', mustBeRobot, updateRobotMeta, async (req: Request, res) => {

    /*
    Events sent by aktualizr:
        CampaignAcceptedReport(const std::string& campaign_id);
        CampaignDeclinedReport(const std::string& campaign_id);
        CampaignPostponedReport(const std::string& campaign_id);
        DevicePausedReport(const std::string& correlation_id);
        DeviceResumedReport(const std::string& correlation_id);
        EcuDownloadStartedReport(const Uptane::EcuSerial& ecu, const std::string& correlation_id);
        EcuDownloadCompletedReport(const Uptane::EcuSerial& ecu, const std::string& correlation_id, bool success);
        EcuInstallationStartedReport(const Uptane::EcuSerial& ecu, const std::string& correlation_id);
        EcuInstallationAppliedReport(const Uptane::EcuSerial& ecu, const std::string& correlation_id);
        EcuInstallationCompletedReport(const Uptane::EcuSerial& ecu, const std::string& correlation_id, bool success);
    */

    const {
        team_id,
        robot_id
    } = req.robotGatewayPayload!;

    const events = req.body as IRobotEvent[];

    const robotEvents = events.map(robotEvent => ({
        team_id,
        robot_id,
        event_type: robotEvent.eventType.id,
        device_time: robotEvent.deviceTime,
        ecu: robotEvent.event.ecu,
        success: robotEvent.event.success
    }));

    await prisma.robotEvent.createMany({
        data: robotEvents
    });

    logger.info('ingested robot event');
    return res.status(200).end();
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
    return res.status(200).end();
});


export default router;
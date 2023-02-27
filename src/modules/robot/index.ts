import express, { Request } from 'express';
import forge from 'node-forge';
import { logger } from '@airbotics-core/logger';
import { generateKeyPair, certificateManager } from '@airbotics-core/crypto';
import { prisma } from '@airbotics-core/drivers';
import { EKeyType, ROOT_BUCKET, ROOT_CA_CERT_OBJ_ID, ROOT_CA_KEY_ID } from '@airbotics-core/consts';
import { mustBeRobot, updateRobotMeta } from '@airbotics-middlewares';
import dayjs, { ManipulateType } from 'dayjs';
import config from 'src/config';
import { delay } from '@airbotics-core/utils';
import { CertificateType } from '@prisma/client';
import { aktualizrEvent, AktualizrEvent } from '@airbotics-core/events';
import { keyStorage } from '@airbotics-core/key-storage';
import { blobStorage } from '@airbotics-core/blob-storage';
import { generateCertificate } from '@airbotics-core/crypto/certificates/temp';

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

    /*
    // generate key pair for the cert, this will be thrown away
    const robotKeyPair = generateKeyPair({ keyType: EKeyType.Rsa });

    // const certExpiresAt = dayjs().add(config.ROBOT_CERT_TTL[0] as number, config.ROBOT_CERT_TTL[1] as ManipulateType);

    // const robotCertId = await certificateManager.issueCertificate(team_id, robotKeyPair, CertificateType.robot, robotId, certExpiresAt);

    const robotCertId = await certificateManager.issueCertificate(team_id, robotKeyPair, CertificateType.robot, robotId, dayjs().add(1, 'year'));

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
            name: robotId
        }
    });
    */
    await prisma.robot.create({
        data: {
            team_id,
            id: robotId,
            name: robotId
        }
    });

    const robotKeyPair = generateKeyPair({ keyType: EKeyType.Rsa });

    // load root ca and key, used to sign provisioning cert
    const rootCaKeyPair = await keyStorage.getKeyPair(ROOT_CA_KEY_ID);
    const rootCaCertStr = await blobStorage.getObject(ROOT_BUCKET, '', ROOT_CA_CERT_OBJ_ID) as string;
    const rootCaCert = forge.pki.certificateFromPem(rootCaCertStr);

    // generate provisioning cert using root ca as parent
    const opts = {
        commonName: deviceId,
        parentCert: rootCaCert,
        parentKeyPair: rootCaKeyPair
    };
    const robotCert = generateCertificate(robotKeyPair, opts);

    // bundle into pcks12, no encryption password set
    const p12 = forge.pkcs12.toPkcs12Asn1(forge.pki.privateKeyFromPem(robotKeyPair.privateKey), [robotCert, rootCaCert], null, { algorithm: 'aes256' });


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

    for(const event of events)  {
        aktualizrEvent.emit(event)
    } 

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
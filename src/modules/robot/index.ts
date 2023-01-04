import express, { Request } from 'express';
import forge from 'node-forge';
import { keyStorage } from '@airbotics-core/key-storage';
import { blobStorage } from '@airbotics-core/blob-storage';
import { logger } from '@airbotics-core/logger';
import { generateCertificate, generateKeyPair } from '@airbotics-core/crypto';
import prisma from '@airbotics-core/postgres';
import {
    EKeyType,
    RootBucket,
    RootCACertObjId,
    RootCAPrivateKeyId,
    RootCAPublicKeyId
} from '@airbotics-core/consts';
import { ensureRobotAndNamespace } from '@airbotics-middlewares';

const router = express.Router();


/**
 * A robot is provisioning itself using the provisioning credentials.
 * 
 * - Create the robot in the db.
 * - Generate a p12 and send it back.
 * 
 * NOTE: This is the only endpoint that doesn't use the `ensureRobotAndNamespace` middleware.
 * Instead it directly pulls out the `air-client-id` header, which for this endpoint only
 * is the namespace id.
 * 
 * TODO:
 * - handle ttl
 */
router.post('/devices', async (req: Request, res) => {

    const {
        deviceId,
        ttl
    } = req.body;

    const namespace_id = req.header('air-client-id')!;

    try {
        await prisma.robot.create({
            data: {
                namespace_id,
                id: deviceId
            }
        });

    } catch (error) {
        if (error.code === 'P2002') {
            logger.warn('could not provision robot because it is already provisioned');
            return res.status(400).json({ code: 'device_already_registered' });
        }
        throw error;
    }


    const robotKeyPair = generateKeyPair({ keyType: EKeyType.Rsa });

    // load root ca and key, used to sign provisioning cert
    const rootCaPrivateKeyStr = await keyStorage.getKey(RootCAPrivateKeyId);
    const rootCaPublicKeyStr = await keyStorage.getKey(RootCAPublicKeyId);
    const rootCaCertStr = await blobStorage.getObject(RootBucket, RootCACertObjId) as string;
    const rootCaCert = forge.pki.certificateFromPem(rootCaCertStr);

    // generate provisioning cert using root ca as parent
    const opts = {
        commonName: deviceId,
        parentCert: rootCaCert,
        parentKeyPair: {
            privateKey: rootCaPrivateKeyStr,
            publicKey: rootCaPublicKeyStr
        }
    };
    const robotCert = generateCertificate(robotKeyPair, opts);

    // bundle into pcks12, no encryption password set
    const p12 = forge.pkcs12.toPkcs12Asn1(forge.pki.privateKeyFromPem(robotKeyPair.privateKey), [robotCert, rootCaCert], null, { algorithm: 'aes256' });

    logger.info('robot has provisioned')
    return res.status(200).send(Buffer.from(forge.asn1.toDer(p12).getBytes(), 'binary'));

});

router.put('/system_info', ensureRobotAndNamespace, async (req: Request, res) => {
    console.log(req.headers)
    console.log(req.body)
    return res.status(200).end();
})

router.post('/system_info/config', ensureRobotAndNamespace, async (req: Request, res) => {
    console.log(req.headers)
    console.log(req.body)
    return res.status(200).end();
})

router.put('/core/installed', ensureRobotAndNamespace, async (req: Request, res) => {
    console.log(req.headers)
    console.log(req.body)
    return res.status(200).end();
})

router.post('/events', ensureRobotAndNamespace, async (req: Request, res) => {
    console.log(req.headers)
    console.log(req.body)
    return res.status(200).end();
})

/**
 * Ingest network info reported by a robot
 */
router.put('/system_info/network', ensureRobotAndNamespace, async (req: Request, res) => {

    const {
        hostname,
        local_ipv4,
        mac
    } = req.body;

    const {
        namespace_id,
        robot_id
    } = req.robotGatewayPayload!;

    await prisma.networkReport.create({
        data: {
            namespace_id,
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
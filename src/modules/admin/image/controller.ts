import { Request, Response, NextFunction } from 'express';
import { EHashDigest} from '@airbotics-core/consts';
import { SuccessJsonResponse, NoContentResponse } from '@airbotics-core/network/responses';
import { logger } from '@airbotics-core/logger';
import prisma from '@airbotics-core/drivers/postgres';
import { generateHash } from '@airbotics-core/crypto';
import config from '@airbotics-config';
import { generateSignedSnapshot, generateSignedTargets, generateSignedTimestamp, getLatestMetadata, getLatestMetadataVersion } from '@airbotics-core/tuf';
import { ImageFormat, TUFRepo, TUFRole, UploadStatus } from '@prisma/client';
import { blobStorage } from '@airbotics-core/blob-storage';
import { keyStorage } from '@airbotics-core/key-storage';
import { v4 as uuidv4 } from 'uuid';
import { getKeyStorageRepoKeyId } from '@airbotics-core/utils';


/**
 * List images in a team.
 */
export const listImages = async (req: Request, res: Response, next: NextFunction) => {

    const teamID = req.headers['air-team-id'];

    // get images
    const images = await prisma.image.findMany({
        where: {
            team_id: teamID
        },
        orderBy: {
            created_at: 'desc'
        }
    });

    const imagesSanitised = images.map(image => ({
        id: image.id,
        size: image.size,
        sha256: image.sha256,
        hwids: image.hwids,
        status: image.status,
        format: image.format,
        created_at: image.created_at,
        updated_at: image.updated_at
    }));

    logger.info('A user read a list of images');
    return new SuccessJsonResponse(res, imagesSanitised);
    
}
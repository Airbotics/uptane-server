import { Request, Response, NextFunction } from 'express';
import { SuccessMessageResponse, BadResponse, SuccessJsonResponse, NoContentResponse } from '@airbotics-core/network/responses';
import { logger } from '@airbotics-core/logger';
import prisma from '@airbotics-core/postgres';
import { blobStorage } from '@airbotics-core/blob-storage';
import { keyStorage } from '@airbotics-core/key-storage';



/**
 * Delete a team
 * 
 * - Deletes team in db, this cascades to all resources.
 * - Deletes bucket and all objects in blob storage.
 * - Deletes keys, images and treehub objects associated with this team.
 * 
 * TODO
 * - delete all keys associated with ecus in this team.
 */
export const deleteTeam = async (req: Request, res: Response, next: NextFunction) => {
    
    const teamID = req.headers['air-team-id']!;

    const teamCount = await prisma.team.count({
        where: {
            id: teamID
        }
    });

    if (teamCount === 0) {
        logger.warn('could not delete a team because it does not exist');
        return res.status(400).send('could not delete team');
    }

    await prisma.$transaction(async tx => {

        // delete team in db
        await tx.team.delete({
            where: {
                id: teamID
            }
        });

        // deletes bucket in blob storage
        await blobStorage.deleteBucket(teamID);

        await keyStorage.deleteKey(`${teamID}-image-root-private`);
        await keyStorage.deleteKey(`${teamID}-image-targets-private`);
        await keyStorage.deleteKey(`${teamID}-image-snapshot-private`);
        await keyStorage.deleteKey(`${teamID}-image-timestamp-private`);

        await keyStorage.deleteKey(`${teamID}-image-root-public`);
        await keyStorage.deleteKey(`${teamID}-image-targets-public`);
        await keyStorage.deleteKey(`${teamID}-image-snapshot-public`);
        await keyStorage.deleteKey(`${teamID}-image-timestamp-public`);

        await keyStorage.deleteKey(`${teamID}-director-root-private`);
        await keyStorage.deleteKey(`${teamID}-director-targets-private`);
        await keyStorage.deleteKey(`${teamID}-director-snapshot-private`);
        await keyStorage.deleteKey(`${teamID}-director-timestamp-private`);

        await keyStorage.deleteKey(`${teamID}-director-root-public`);
        await keyStorage.deleteKey(`${teamID}-director-targets-public`);
        await keyStorage.deleteKey(`${teamID}-director-snapshot-public`);
        await keyStorage.deleteKey(`${teamID}-director-timestamp-public`);

    });

    logger.info('a user deleted a team');
    return new NoContentResponse(res, 'The team has been deleted')
}


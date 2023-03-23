import {
    ListObjectsCommand,
    DeleteObjectCommand,
    GetObjectCommand,
    PutObjectCommand,
    GetObjectCommandOutput
} from '@aws-sdk/client-s3';
import { s3Client } from '@airbotics-core/drivers';
import { IBlobStorageProvider } from '@airbotics-types';
import { logger } from '@airbotics-core/logger';
import { Readable } from 'stream';


/**
 * AWS s3 blob storage provider.
 * 
 * Stores blobs on s3.
 * 
 * Note: this doesn't delete files from nested paths neatly. It deletes the files but keeps the directories.
 */
export class s3BlobProvider implements IBlobStorageProvider {

    async putObject(bucketId: string, teamId: string, objectId: string, content: Buffer | string): Promise<boolean> {

        const params = {
            Bucket: bucketId,
            Key: `${teamId}/${objectId}`,
            Body: content
        };

        const res = await s3Client.send(new PutObjectCommand(params));

        if (res.$metadata.httpStatusCode !== 200) {
            logger.error('could not upload blob to s3');
            new Error('an unknown error occurred.');
        }

        return res.$metadata.httpStatusCode === 200;
    }

    async getObject(bucketId: string, teamId: string, objectId: string): Promise<Readable> {

        const cmd = new GetObjectCommand({
            Bucket: bucketId,
            Key: `${teamId}/${objectId}`
        })

        const res: GetObjectCommandOutput = await s3Client.send(cmd);
   
        if (res.$metadata.httpStatusCode !== 200) {
            logger.error('could not get blob from s3');
            new Error('an unknown error occurred.');
        }
        
        return res.Body as Readable;

    }


    async deleteObject(bucketId: string, teamId: string, objectId: string): Promise<boolean> {
        const params = {
            Bucket: bucketId,
            Key: `${teamId}/${objectId}`
        };

        const res = await s3Client.send(new DeleteObjectCommand(params));

        if (res.$metadata.httpStatusCode !== 204) {
            logger.error('could not delete blob from s3');
            new Error('an unknown error occurred.');
        }

        return res.$metadata.httpStatusCode === 204;
    }

    // TODO: this may fail if there are greater that 1000 objects returned by the list objects command
    async deleteTeamObjects(bucketId: string, teamId: string): Promise<boolean> {

        const params = {
            Bucket: bucketId,
            Prefix: teamId
        };

        const data = await s3Client.send(new ListObjectsCommand(params));

        let objects = data.Contents;

        if (!objects) {
            return true;
        }

        for (let i = 0; i < objects.length; i++) {

            const deleteParams = {
                Bucket: params.Bucket,
                Key: objects[i].Key,
            };
            await s3Client.send(new DeleteObjectCommand(deleteParams));

        }

        return true;
    }

}
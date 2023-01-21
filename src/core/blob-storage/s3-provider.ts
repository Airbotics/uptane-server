import {
    ListObjectsCommand,
    DeleteObjectCommand,
    GetObjectCommand,
    PutObjectCommand
} from '@aws-sdk/client-s3';
import { s3Client } from '@airbotics-core/drivers';
import { IBlobStorageProvider } from '@airbotics-types';
import { logger } from '@airbotics-core/logger';


/**
 * AWS s3 blob storage provider.
 * 
 * Stores blobs on s3.
 */
export class s3BlobProvider implements IBlobStorageProvider {

    async putObject(bucketId: string, teamId: string, objectId: string, content: Buffer | string): Promise<void> {
        const params = {
            Bucket: bucketId,
            Key: objectId,
            Body: content
        };

        const res = await s3Client.send(new PutObjectCommand(params));

        if (res['$metadata'].httpStatusCode !== 200) {
            logger.error('could not upload blob to s3');
            new Error('an unknown error occurred.');
        }
    }

    async getObject(bucketId: string, teamId: string, objectId: string): Promise<Buffer | string> {
        const params = {
            Bucket: bucketId,
            Key: objectId
        };

        const res = await s3Client.send(new GetObjectCommand(params));

        if (res['$metadata'].httpStatusCode !== 200) {
            logger.error('could not get blob from s3');
            new Error('an unknown error occurred.');
        }
        // TODO 
        //@ts-ignore
        return res.Body;
    }

    async deleteObject(bucketId: string, teamId: string, objectId: string): Promise<void> {
        const params = {
            Bucket: bucketId,
            Key: objectId
        };

        const res = await s3Client.send(new DeleteObjectCommand(params));

        if (res['$metadata'].httpStatusCode !== 200) {
            logger.error('could not delete blob from s3');
            new Error('an unknown error occurred.');
        }
    }

    // TODO: this may fail if there are greater that 1000 objects returned by the list objects command
    async deleteTeamObjects(bucketId: string, teamId: string): Promise<void> {

        const params = {
            Bucket: bucketId,
            Prefix: teamId
        };

        const data = await s3Client.send(new ListObjectsCommand(params));

        let objects = data.Contents;

        if (!objects) {
            return;
        }

        for (let i = 0; i < objects.length; i++) {

            const deleteParams = {
                Bucket: params.Bucket,
                Key: objects[i].Key,
            };
            await s3Client.send(new DeleteObjectCommand(deleteParams));

        }
    }

}
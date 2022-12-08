import {
    paginateListObjectsV2,
    ListObjectsV2CommandInput,
    CreateBucketCommand,
    DeleteBucketCommand,
    DeleteObjectCommand,
    GetObjectCommand,
    PutObjectCommand
} from '@aws-sdk/client-s3';
import { s3 } from '@airbotics-core/s3';
import { IBlobStorageProvider } from '@airbotics-types';
import { logger } from '@airbotics-core/logger';


/**
 * Helper function to delete all objects in a bucket
 */
const deleteAllObjects = async (params: ListObjectsV2CommandInput) => {

    for await (const data of paginateListObjectsV2({ client: s3 }, params)) {
        if (data.Contents) {
            for (const obj of data.Contents) {
                const bucketParams = {
                    Bucket: params.Bucket,
                    Key: obj.Key
                };
                await s3.send(new DeleteObjectCommand(bucketParams));
            }
        }
    }

};


/**
 * AWS s3 blob storage provider.
 * 
 * Stores blobs on s3.
 */
export class s3BlobProvider implements IBlobStorageProvider {

    async createBucket(bucketId: string): Promise<void> {
        const params = {
            Bucket: bucketId
        };

        const res = await s3.send(new CreateBucketCommand(params));

        if (res['$metadata'].httpStatusCode !== 200) {
            logger.error('could not create bucket in s3');
            new Error('an unknown error occurred.');
        }
    }

    async deleteBucket(bucketId: string): Promise<void> {

        const params = {
            Bucket: bucketId
        };

        // s3 doesn't allow us to delete a bucket that has objects in it
        // so our first step is to empty the bucket of objects
        await deleteAllObjects(params);


        // now that the bucket is empty we can delete it
        const res = await s3.send(new DeleteBucketCommand(params));

        if (res['$metadata'].httpStatusCode !== 200) {
            logger.error('could not delete bucket in s3');
            new Error('an unknown error occurred.');
        }
    }

    async putObject(bucketId: string, objectId: string, content: Buffer | string): Promise<void> {
        const params = {
            Bucket: bucketId,
            Key: objectId,
            Body: content
        };

        const res = await s3.send(new PutObjectCommand(params));

        if (res['$metadata'].httpStatusCode !== 200) {
            logger.error('could not upload blob to s3');
            new Error('an unknown error occurred.');
        }
    }

    async getObject(bucketId: string, objectId: string): Promise<Buffer | string> {
        const params = {
            Bucket: bucketId,
            Key: objectId
        };

        const res = await s3.send(new GetObjectCommand(params));

        if (res['$metadata'].httpStatusCode !== 200) {
            logger.error('could not get blob from s3');
            new Error('an unknown error occurred.');
        }
        // TODO 
        //@ts-ignore
        return res.Body;
    }

    async deleteObject(bucketId: string, objectId: string): Promise<void> {
        const params = {
            Bucket: bucketId,
            Key: objectId
        };

        const res = await s3.send(new DeleteObjectCommand(params));

        if (res['$metadata'].httpStatusCode !== 200) {
            logger.error('could not delete blob from s3');
            new Error('an unknown error occurred.');
        }
    }

}



// const mapKeys = Array.from({ length: map.num_versions }, (_, i) => ({ Key: `${map.id}/${i}.pgm` }));

// const params = {
//     Bucket: config.get('MAPS_BUCKET_NAME'),
//     Delete: {
//         Objects: mapKeys,
//         Quiet: true
//     }
// };

// const s3Rsponse = await s3Driver.send(new DeleteObjectsCommand(params));

// if (s3Rsponse['$metadata'].httpStatusCode !== 200) {
//     logger.error('Error occured deleting map data from s3.');
//     throw new Error('An unknown error occurred.');
// }

// const objectKey = `${map.id}/${map.num_versions}.pgm`;

// const params = {
//     Bucket: config.get('MAPS_BUCKET_NAME'),
//     Key: objectKey,
//     Body: req.body as Readable
// };

// const s3Response = await s3Driver.send(new PutObjectCommand(params));

// if (s3Response['$metadata'].httpStatusCode !== 200) {
//     logger.error('Error occured uploading map to s3.');
//     return next(new Error('An unknown error occurred.'));
// }
import { S3Client } from '@aws-sdk/client-s3';
import config from '@airbotics-config';

export const s3 = new S3Client({
    region: config.AWS_REGION,
    // endpoint: config.AWS_S3_ENDPOINT,
    endpoint: 'http://localhost:4566',
    forcePathStyle: true
});

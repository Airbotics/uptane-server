import { secretsManagerClient } from './aws-secrets-manager';
import { s3Client } from './s3';
import { ory } from './ory';
import { acmPcaClient } from './acm-pca';
import prisma from './postgres';

export {
    secretsManagerClient,
    s3Client,
    ory,
    prisma,
    acmPcaClient
};
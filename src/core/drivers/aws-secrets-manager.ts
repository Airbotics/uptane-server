import { SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import config from '@airbotics-config';

export const secretsManagerClient = new SecretsManagerClient({
    region: config.AWS_REGION,
    ...(config.NODE_ENV != 'production' && { endpoint: config.AWS_SM_ENDPOINT })
});


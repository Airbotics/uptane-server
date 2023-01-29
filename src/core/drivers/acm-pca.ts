import { ACMPCAClient } from '@aws-sdk/client-acm-pca';
import config from '@airbotics-config';

export const acmPcaClient = new ACMPCAClient({
    region: config.AWS_REGION,
    ...(config.NODE_ENV != 'production' && { endpoint: config.AWS_LOCAL_ENDPOINT }),
});

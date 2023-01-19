import {
    Configuration,
    FrontendApi,
    IdentityApi,
    PermissionApi,
    RelationshipApi
} from '@ory/client';
import config from '@airbotics-config';

const oryConfig = new Configuration({
    basePath: config.ORY_PROJECT_URL,
    accessToken: config.ORY_ACCESS_TOKEN,
    baseOptions: {
        timeout: config.ORY_TIMEOUT
    }
});


export const ory = {
    identities: new IdentityApi(oryConfig),
    frontend: new FrontendApi(oryConfig),
    permission: new PermissionApi(oryConfig),
    relations: new RelationshipApi(oryConfig)
};
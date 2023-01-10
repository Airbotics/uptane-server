import config from '@airbotics-config';
import { 
    Configuration, 
    FrontendApi, 
    IdentityApi, 
    PermissionApi, 
    RelationshipApi 
} from "@ory/client"


const oryConfig = new Configuration({
    basePath: config.ORY_PROJECT_URL,
    accessToken: config.ORY_ACCESS_TOKEN,
    baseOptions: {
      timeout: 4000
    }
});


export const ory = {
    identities: new IdentityApi(oryConfig),
    frontend: new FrontendApi(oryConfig),
    permission: new PermissionApi(oryConfig),
    relations: new RelationshipApi(oryConfig)
}
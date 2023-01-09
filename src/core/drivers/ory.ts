import config from '@airbotics-config';
import { 
    Configuration, 
    FrontendApi, 
    IdentityApi, 
    PermissionApi, 
    RelationshipApi 
} from "@ory/client"


const oryConfig = new Configuration({
    basePath: "https://dazzling-raman-bd5bt188g5.projects.oryapis.com",
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
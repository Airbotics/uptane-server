import { CreateSecretCommand, GetSecretValueCommand, DeleteSecretCommand } from '@aws-sdk/client-secrets-manager';
import config from '@airbotics-config';
import { secretsManagerClient } from '@airbotics-core/drivers';
import { IKeyPair, IKeyStorageProvider } from '@airbotics-types';


/**
 * AWS secrets manager key storage provider.
 */
export class AWSSecretsManagerProvider implements IKeyStorageProvider {

    async putKeyPair(id: string, keypair: IKeyPair): Promise<boolean> {

        const command = new CreateSecretCommand({
            Name: id,
            SecretString: JSON.stringify(keypair)
        });

        const response = await secretsManagerClient.send(command);

        if (response.$metadata.httpStatusCode !== 200) {
            throw new Error();
        }

        return response.$metadata.httpStatusCode === 200;
        
    }

    async getKeyPair(id: string): Promise<IKeyPair> {

        const command = new GetSecretValueCommand({
            SecretId: id
        });

        const response = await secretsManagerClient.send(command);

        if (response.$metadata.httpStatusCode !== 200) {
            throw new Error();
        }

        return JSON.parse(response.SecretString!);
    }

    async deleteKeyPair(id: string): Promise<boolean> {

        const command = new DeleteSecretCommand({
            ForceDeleteWithoutRecovery: true,
            SecretId: id
        });

        const response = await secretsManagerClient.send(command);

        if (response.$metadata.httpStatusCode !== 200) {
            throw new Error();
        }

        return response.$metadata.httpStatusCode === 200;
    }

}


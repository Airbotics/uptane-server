# Working with AWS Secrets Manager

We like to use AWS Secrets Manager for protecting secrets. We tend to use [localstack](https://localstack.cloud/) for development, this runs a mocked AWS cloud locally.


### Useful commands

**Create a secret**
```
aws --endpoint-url http://localhost:4566 secretsmanager create-secret --name my-secret --secret-string '{"lorem":"ipsum"}'
```

**List secrets**
```
aws --endpoint-url http://localhost:4566 secretsmanager list-secrets
```

**Get secret**
```
aws --endpoint-url http://localhost:4566 secretsmanager get-secret-value --secret-id my-secret
```

**Force delete secret**
```
aws --endpoint-url http://localhost:4566 secretsmanager delete-secret --force-delete-without-recovery --secret-id my-secret
```
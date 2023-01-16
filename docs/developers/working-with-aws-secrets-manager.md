# Working with AWS Secrets Manager

We like to use AWS Secrets Manager for protecting secrets. We tend to use [localstack](https://localstack.cloud/) for development, this runs a mocked AWS cloud locally.


### Useful commands

**Create a secret**
```
aws secretsmanager --endpoint-url http://localhost:4566 create-secret --name my-secret --secret-string '{"lorem":"ipsum"}'
```

**List secrets**
```
aws secretsmanager --endpoint-url http://localhost:4566 list-secrets
```

**Get secret**
```
aws secretsmanager --endpoint-url http://localhost:4566 get-secret-value --secret-id my-secret
```

**Force delete secret**
```
aws secretsmanager --endpoint-url http://localhost:4566 delete-secret --force-delete-without-recovery --secret-id my-secret
```
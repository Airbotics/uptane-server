# Working with...


## Working with certificates

**Inspect x.509 certificate**
```
openssl x509 -in path/to/cert -text
```

**Testing mutual TLS authentication given a p12**
```
curl -v --cert-type P12 --cert path/to/client.p12 https://localhost:8003
```

or

```
openssl pkcs12 -in test.p12 -out ca.pem -cacerts -nokeys
openssl pkcs12 -in test.p12 -out client.pem -clcerts -nokeys
openssl pkcs12 -in test.p12 -nocerts -nodes  | openssl rsa -out privkey.pem
curl -v --cacert ca.pem --cert ./client.pem:1234 --key ./privkey.pem https://localhost:8003
```

**Inspect a p12**
```
openssl pkcs12 -in path/to/client.p12 -nodes -passin pass:"" 
```

**Test private key and cert match (output should be the same)**
```
openssl x509 -noout -modulus -in server.crt | openssl md5
openssl rsa -noout -modulus -in server.key | openssl md5
```

## Working with AWS Secrets Manager

We like to use AWS Secrets Manager for protecting secrets.

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


## Working with Postgres

We like to use Postgres as our relational database.

Firstly, bring up Postgres in a Docker container with:

```
docker compose up postgres
```

**Push the schema**
```
npx prisma db push --schema ./src/prisma/schema.prisma
```

**Run studio**
```
npx prisma studio --schema ./src/prisma/schema.prisma
```

If you want a SQL session you can connect to it using:
```
PGPASSWORD=password psql -h localhost -p 5432  -U user -d db
```

NOTE: none of this should be done in production.



## Working with s3

We like to use AWS s3 for storing blobs.

### Bucket layout

Buckets ids are the same ids used for teams. Within a bucket we two types of objects, images and treehub objects. Their object ids are the object type, followed by a slash, followed by the actual id of the object.

| <- bucket id -> | <- object id ->    |
| --------------- | ------------------ |
| \<team-id>     | /treehub/summary |
| \<team-id>     | /treehub/deltas/\<delta-id> |
| \<team-id>     | /treehub/objects/\<object-id> |


Layout:

```
├── <team-id>
│   └── treehub
│       ├── objects
│       |   └── <object-id>
│       ├── deltas
│       |   └── <delta-id>
│       └── summary
```


### Useful commands

**List buckets**
```
aws s3 --endpoint-url http://localhost:4566 ls
```

**Create bucket**
```
aws s3 --endpoint-url http://localhost:4566 mb s3://<bucket>
```

**List objects in bucket**
```
aws s3 --endpoint-url http://localhost:4566 ls s3://<bucket>
```

**Force empty and delete bucket**
```
aws s3 --endpoint-url http://localhost:4566 rb s3://<bucket> --force
```

**Copy file from local to remote**
```
echo "test content" >> test.txt
aws s3 --endpoint-url http://localhost:4566 cp test.txt s3://<bucket>/bucket-id
```

**Copy file from remote to local**
```
aws s3 --endpoint-url http://localhost:4566 cp s3://<bucket>/bucket-id new-test.txt
```
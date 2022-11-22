# Developers guide

This guide is for developers that want to work on and develop Airbotics. Its recommended to start by reading the [user guide](user-guide.md) first to familiarise yourself with the system at a high level first.


## Including a license notice

This notice should be included at the top of every source code file:

```
/**
 * Copyright 2022 Airbotics, Inc. All Rights Reserved.
 * See LICENSE for license information.
 */
```

## Commit messages

We don't use structured commit messages (yet) and keep our commit messages short, simple and description in lowercase present tense. We'll probably change this over time. 

Examples:

- _adding magic feature_

- _fixing that problem_

- _making infrastructure go brrrr_

## Environment variables

We use the `dotenv` to read environment variables into the app. This reads from a `.env` file at the project's root directory. It should be populated with these variables:

```
PORT                    - port the express app listens on
NODE_ENV                - mode to run the server in, 'production' or 'development'
POSTGRES_CONN_STR       - connection string for postgres
AWS_REGION              - aws region to use
AWS_ACCESS_KEY_ID       - aws access key id
AWS_SECRET_ACCESS_KEY   - aws secret acess key
AWS_S3_ENDPOINT         - aws s3 endpoint to connect to
```


## Running the server

From the root directory run the below command.

```
npm run start
```


## Logging

We use [winston](https://www.npmjs.com/package/winston) for logging.

Currently, logs are sent to the console and written to a log file in the `config.LOGS_DIR` directory with a filename of the datetime for when the server started.

Log levels and explantations:

| Level   | Desc                                                   | Env       | Examples                       |
| ------- | ------------------------------------------------------ | --------- | ------------------------------ |
| `debug` | To help developers understanding of the control flow.  | Dev       | _Endpoint hit, db queries_     |
| `info`  | General information about the application.             | Dev, Prod | _App started, db connected_    |
| `warn`  | Something unusual, but not unexpected has happened.    | Dev, Prod | _404, invalid request, expiry_ |
| `error` | Something that should not have happened has happened.  | Dev, Prod | _500 error_                    |

Log messages are lowercase without full stops.

Mutations (POST, PUT, PATCH, DELETE) should produce an `info` level log message. Reads (OPTION, GET) do not produce a log message (unless there is an error).


## Infrastructure

All infrastructure for Airbotics can be run in containers (we tend to use Docker). You can bring up the entire stack with:

```
mkdir .localstack
docker compose up
```


## Working with Postgres

Firstly, bring up Postgres in a Docker container with:

```
docker compose up postgres
```

Then (in development) push the schema to it with:

```
npx prisma db push --schema ./src/prisma/schema.prisma
```

You can then inspect the schema and contents with:

```
npx prisma studio --schema ./src/prisma/schema.prisma
```

If you want a SQL session you can connect to it using:

```
PGPASSWORD=password psql -h localhost -p 5432  -U user -d db
```

NOTE: none of this should be done in production.


## Working with s3

We like to use AWS and s3 for storing blobs. We tend to use [localstack](https://localstack.cloud/) for development, this runs a mocked AWS cloud locally. You can swap this out with some other provider.

### Bucket layout

Buckets ids are the same ids used for namespaces. Within a bucket we two types of objects, images and treehub objects. Their object ids are the object type, followed by a slash, followed by the actual id of the object.

| <- bucket id -> | <- object id ->    |
| --------------- | ------------------ |
| \<namespace>     | /images/\<image-id> |
| \<namespace>     | /images/\<image-id> |


Layout:

```
├── <namespace>
│   ├── images
│   │   └── <image-id>
│   ├── treehub
│   │   └── <object-id>
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
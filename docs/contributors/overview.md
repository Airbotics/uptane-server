# Developers guide

This guide is for developers that want to work on and develop Airbotics. It's recommended to start by reading the [overview](../introduction/overview.md) first to familiarise yourself with the system at a high level first.


## Documentation

If you add a page to documentation, you'll need to add it to the `SUMMARY.md` document for it to be listed.


## Commit messages

We don't use structured commit messages (yet) and keep our commit messages short, simple and description in lowercase present tense. We'll probably change this over time. 

Examples:

- _adding magic feature_

- _fixing that problem_

- _making infrastructure go brrrr_


## Testing

We make use of [jest](https://jestjs.io/) for testing all ts components. Currently the repo is configured to run any file with a `spec.ts` extension. However all tests are and should be placed in `/tests/<module>/<test>.spec.ts`.


### Running tests
You should be able to run all tests with `npm test` 


## Environment variables

We use the `dotenv` to read environment variables into the app. This reads from a `.env` file at the project's root directory. It should be populated with these variables:

```
PORT                    - port the express app listens on
NODE_ENV                - mode to run the server in, 'production' or 'development'
POSTGRES_CONN_STR       - connection string for postgres
AWS_REGION              - aws region to use
AWS_ACCESS_KEY_ID       - aws access key id
AWS_SECRET_ACCESS_KEY   - aws secret acess key
AWS_LOCAL_ENDPOINT      - local aws endpoint
AWS_ACM_PCA_ROOT_CA_ARN - arn of aws acm pca root ca
ORY_PROJECT_URL         - url of ory project to be used for auth
ORY_ACCESS_TOKEN        - valid ory PAC for admin calls
ORY_DEV_PWD             - valid password of ory developer identity
ORY_DEV_IDENTIFIER      - valid ory developer identity
ORY_SCHEMA_ID           - schema ID used by ory to manage identities
```


## Running the server

From the root directory run the below command.

```
npm run start
```

## Creating a migration

```
npx prisma migrate dev --schema=./src/prisma/schema.prisma --name <name> --create-only
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


## Infrastructure

All infrastructure for Airbotics can be run in containers (we tend to use Docker). You can bring up the entire stack with:

```
docker compose up
```

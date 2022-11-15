# Guide to developing Airbotics

## Including a license notice

This notice should be included at the top of every source code file:

```
/**
 * Copyright 2022 Airbotics, Inc. All Rights Reserved.
 * See LICENSE for license information.
 */
```


## Environment variables

We use the `dotenv` to read environment variables into the app. This reads from a `.env` file at the project's root directory. It should be populated with these variables:

```
PORT                    - port the express app listens on
NODE_ENV                - mode to run the server in, 'production' or 'development'
POSTGRES_CONN_STR       - connection string for postgres
```


## Running the server

From the root directory run the below command.

```
npm run start
```


## Working with databases

Firstly, you'll have to bring up Postgres in a docker container with:

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
# Working with Postgres

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


## Seeding Postgres

Once you have postgres running, you can seed it using the scripts found in `src/prisma/seeders`. The scripts here work in pairs and should always include an *up* script and *down* script. The *up* should create some records in the locally running database, and the *down* should drop these records.

Example running the *dev* seeder:

Up
```
npx ts-node npx ts-node src/prisma/seeders/dev-up.ts
```
Down
```
npx ts-node npx ts-node src/prisma/seeders/dev-down.ts
```
Although these scripts are only acting on the locally running db, be careful with down scripts as the dropping of records cannot be undone.


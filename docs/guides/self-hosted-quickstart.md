# Self-Hosted Quickstart Guide

This guide provides the steps to set up the key Airbotics components to run in a **development** envirnoment. By the end of this guide you should be able to:

* Set up a test namespace
* Upload a test image
* Create a test rollout
* Provision a test robot
* Have the test robot install the test image from the rollout


## Requirements
The following software tools are required to start this quickstart guide: 
* [NodeJS and npm](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm) installed.
* [Docker](https://docs.docker.com/get-docker/) installed.
* [Docker Compose](https://docs.docker.com/compose/install/) installed.
* Run `npm install`


## Setup Backend
The first step is to get the core backend infrastructure up and running. This includes:
1. The API gateway
2. The Director and Image repos
3. The database for the Director and Image repos 

Before we can get this core infrastructure running we need to create a root CA, generate some rsa key pairs and x.509 certificates. You can dive into more detail about why these are need in the developers guide.

### Create a Root CA Cert

This will create a public and private key for the root CA and store them in the key server. It will also create a cert and store it in blob storage under the `root-ca` bucket.

```
npx ts-node scripts/manage-ca-cert.ts create
```

### Create a cert for the API Gateway

This will create a public and private key for the API Gateway and store them in the key server. It will also create a cert and store it in blob storage under the `certs` bucket with name `gateway`.

```
npx ts-node scripts/manage-cert.ts create gateway localhost
```

### Standup the API Gateway
This will pass the the Root CA cert and the Gateway cert from the last step as volumes, so ensure you have completed these steps before trying to standup the gateway.

```
docker-compose up gateway
```

### Standup database for the Director and Image repos
This will pass the the Root CA cert and the Gateway cert from the last step as volumes, so ensure you have completed these steps before trying to standup the gateway.

```
docker-compose up postgres
```


### Initialise schema (On first run)
If this is the first time standing up postgres, you will need to push the schema. 
```
npx prisma db push --schema ./src/prisma/schema.prisma 
```


### Seed the database (On first run)
If this is the first time standing up postgres, seed it with some test data which will create the following records:
1. One test namespace
2. Two test images (one for primary and secondary ecus) 
3. A full set of TUF Metadata for the 4 top level roles in the image repo
4. Two tmp rollouts, mapping the two test images to the two test ECUs

```
npx prisma db push --schema ./src/prisma/schema.prisma 
```

### Standup the Director and Image repos
Finally we are ready to start the director and image repos in the development envirnoment:

```
npm run start 
```


## Setup Client 
let aktualizr blow everything up



## Summary
Congratulations, you've completed the Airbotics Quickstart Guide, by this stage you have a fully functional

## Teardown Backend




## Next Steps
* Join the Airbotics community
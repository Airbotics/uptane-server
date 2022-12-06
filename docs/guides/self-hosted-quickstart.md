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
*The airbotics agent is still under development at this time. In the meantime we have provided a mocked primary client in python that you can use to test with the backend. These instructions will be replaced soon*

### Initialise primary client filesystem
This will set up the local directories required for the mocked primary client.
```
cd scripts/mock-uptane

python ops.py init-primary-fs 

python ops.py cp-root-meta
```

### Running the client
Everything should now be in place to run the primary client. From here you will be able to perform one of 7 actions.
```
python primary.py
```

| Action                                  | Description                                                              |
| ----------------------------------------| ------------------------------------------------------------------------ |
| 1. Inspect generated robot manifest     | Print out the generaged robot manifest without sending it to the backend |
| 2. Generate and send robot manifest     | Send the generate robot manifest to the backend                          | 
| 3. Refresh top level metadata           | Refresh the Top level TUF metadata from the image and director repo.     |
| 4. Run update cycle                     | Run the full Uptane update cycle                                         |
| 5. "Install" image on primary ECU       | Change what "installed" image the primary ecu sends with its manifest    |
| 6. "Install" image on secondary ECU     | Change what "installed" image the secondary ecu sends with its manifest  |
| 7. "Report" detected attack on ECU      | Change what "attack" primary ecu sends with its manifest                 |



## Summary
Congratulations, you've completed the Airbotics Quickstart Guide, by this stage you should hopefully have an idea of the main components in Airbotics and the data flow between them.


## Teardown 
Once you are finished the guide you can perform the following:

* Stop the primary client by typing `q` into the primaries prompt
* Stop the gateway `docker-compose down gateway`
* Stop postgres `docker-compose down postgres`
* Kill the server you started with `npm run start `


## Before you go
* Join the Airbotics community
* Any feedback is more than welcome
* Check out the other guides 
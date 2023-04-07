# Self-hosting

:warning: :warning: This  guide is WIP and may be incomplete or unstable :warning: :warning:

This guide provides the steps to set up the key Airbotics components to run in a **development** envirnoment. By the end of this guide you should be able to:

* Set up a test team
* Upload a test image
* Create a test rollout
* Provision a test robot
* Have the test robot install the test image from the rollout


## Requirements
The following software tools are required to start this quickstart guide: 
* [NodeJS and npm](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm) installed.
* [Docker](https://docs.docker.com/get-docker/) installed.
* [Docker Compose](https://docs.docker.com/compose/install/) installed.
* Run `npm install`.


## Environment variables

We use the `dotenv` to read environment variables into the app. This reads from a `.env` file at the project's root directory. It should be populated with these variables:

```
PORT                    - port the express app listens on
NODE_ENV                - mode to run the server in, 'production' or 'development'
POSTGRES_CONN_STR       - connection string for postgres
ORY_PROJECT_URL         - url of ory project to be used for auth
ORY_ACCESS_TOKEN        - valid ory PAC for admin calls
ORY_DEV_PWD             - valid password of ory developer identity
ORY_DEV_IDENTIFIER      - valid ory developer identity
ORY_SCHEMA_ID           - schema ID used by ory to manage identities
```



## Setup Backend
The first step is to get the core backend infrastructure up and running. This includes:
1. The API gateway
2. The Director and Image repos
3. The database for the Director and Image repos 

Before we can get this core infrastructure running we need to create a root CA, generate some key pairs and x.509 certificates. You can dive into more detail about why these are need in the developers guide.

### Create a Root CA and gateway cert
Execute `npm run helper` and choose `[1] Create root and gateway cert`. When the prompt for `CN` is shown, enter `localhost`. This will create a pair of keys for the Root CA and gateway cert and use them to create a certificate for both. Keys will be stored in the keyserver and certs in blob storage. In development this will store the keys and certificates in the local file system. Your root project directory should contain the following:

```
├── .blobs
│   └── certs
│       ├── gateway-cert
│       └── root-ca-cert
└── .keys
    ├── gateway-key-public.pem
    ├── gateway-key-private.pem
    ├── root-ca-key-private.pem
    └── root-ca-key-public.pem
```

### Configuring the API Gateway
Depending on your host os, the gateway config may have to be changed. Update the the `res/nginx.cong` depending on your host OS.

| Host OS | Value of `proxy_pass`               |
| --------| ----------------------------------- |
| MacOS   | `http://host.docker.internal:8001;` |
| Linux   | `http://172.17.0.1:8001;`           |


### Standup the API Gateway
Ensure you have run `npm run helper` before trying to standup the gateway otherwise it will fail to find the certificates and keys it requires.

```
docker-compose up gateway
```

### Standup database for the Director and Image repos
This will pass the the Root CA cert and the Gateway cert from the last step as volumes, so ensure you have completed these steps before trying to standup the gateway.

```
docker-compose up postgres
```


### Initialise schema
If this is the first time standing up postgres, you will need to push the schema. 
```
npx prisma db push --schema ./src/prisma/schema.prisma 
```


## Authentication
At this point you are almost ready to start interacting with the airbotics API. The final step is to authenticate yourself with ory so you can hit the endpoints. To make this easier we recommend using `rest.http` in the project root in conjunction with the [REST client](https://marketplace.visualstudio.com/items?itemName=humao.rest-client) extension if you use VS code.

### Login
Login by hitting the following endpoints in `rest.http`. If successfull, this will set the `SESSION_TOKEN` variable which is required for every API request hereafter. 

```
GET {{ORY_PROJECT_URL}}/self-service/login/api

POST {{actionURL}}
```


## Setup Complete
Now you are finally ready to complete the guide. At this stage, you should have a functioning gateway, a running backend, a running database and a session token that will allow you to complete the guide.

### Create a team
If this is the first time using the quick start guide, you will need to create a new team. Doing this will also initialise the image and director repo (creating their keys and root metadata in the process. To do this find the create team endpoint in `rest.http`. Feel free to change the team name in the body.

```
POST {{BASE_URL}}/api/{{API_VERSION}}/admin/teams HTTP/1.1
x-session-token: {{SESSION_TOKEN}}
Content-Type: application/json

{
    "name": "Quickstart team"
}
```
After this you can see a list of the teams you are in by hitting the list teams endpoint. This will also initialise the `TEAM_ID` variable we will use for the remaining endpoints in the guide.

```
GET {{BASE_URL}}/api/{{API_VERSION}}/admin/teams HTTP/1.1
x-session-token: {{SESSION_TOKEN}}
```

### Robot Provisioning
With the team initialised you are now ready to create some shared provisioning credentials that you can use to provision your first robot. To create the credentials, hit the following endpoint in `rest.http`.

```
POST {{BASE_URL}}/api/{{API_VERSION}}/admin/provisioning-credentials HTTP/1.1
x-session-token: {{SESSION_TOKEN}}
air-team-id: {{TEAM_ID}}
```
Save the response to disk and call in `credentials.zip`. 


### Build an initial image and provision robot
To provision a robot we need to build an initial image that we will bake the shared provisioning credentials into. When the image is build and booted for the first time, the robot will be able to provision itself and show up in the Airbotics backend. 


### Build an updated image
TODO


### Create a robot group
TODO

| Action                                  | Description                                                              |
| ----------------------------------------| ------------------------------------------------------------------------ |
| 1. Inspect generated robot manifest     | Print out the generaged robot manifest without sending it to the backend |
| 2. Generate and send robot manifest     | Send the generate robot manifest to the backend                          |
| 3. Refresh top level metadata           | Refresh the Top level TUF metadata from the image and director repo.     |
| 4. Run update cycle                     | Run the full Uptane update cycle                                         |
| 5. "Install" image on primary ECU       | Change what "installed" image the primary ecu sends with its manifest    |
| 6. "Install" image on secondary ECU     | Change what "installed" image the secondary ecu sends with its manifest  |
| 7. "Report" detected attack on ECU      | Change what "attack" primary ecu sends with its manifest                 |

### Launch a rollout
TODO


## Summary
Congratulations, you've completed the Airbotics Quickstart Guide, by this stage you should hopefully have an idea of the main components in Airbotics and the data flow between them.


## Teardown 
Once you are finished the guide you can perform the following:

* Stop the gateway `docker-compose down gateway`
* Stop postgres `docker-compose down postgres`
* Kill the server you started with `npm run start`


## Before you go
* Join the Airbotics community.
* Any feedback is very welcome.
* Check out the other guides.
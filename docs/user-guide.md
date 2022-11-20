# User guide

This guide is for users/practitioners that want to set up and use Airbotics, but not develop it.

Assuming your infrastructure is up and running (server listening, db in clean state, etc.) these are the main actions you can take:

## Initialise a namespace

A namespace is a logical collection of resources related to the same project. A few things happen when you create a namespace:

- It's created in the db.
- A bucket in blob storage is created to hold its resources.
- 8 key pairs are created an stored in key storage (4 top-level roles for 2 repositories).
- An initial root.json is created for both repositories.

You can create a namespace with:

```
POST <BASE_URL>/api/v0/admin/namespaces
```


## Adding a robot

Once you have a namespace you can add a robot to it. This action does the following things:

- Creates a robot in the database under the namespace and creates a single ECU in the robot. This ECU will be the primary.
- Creates a key pair for the primary ECU. The public portion is stored in the key server and the private portion is returned to the client.
- Returns bootstrapping credentials the primary requires to provision itself (private key, robot id, etc.)

You can create a robot with:

```
POST <BASE_URL>/api/v0/director/<namespace>/robots
```

## Uploading an image

Once you have a namespace you can upload an image to it, you can do this before or after you've created a robot. This action does the following things:

- It Creates a reference to the image in the database.
- It uploads the image to blob storage.
- It assembles a new set of signed metadata for the image repo which is made available to clients. 

You can upload an image with:


```
POST <BASE_URL>/api/v0/image/images
```

You will need to pass the image in the body of the request.


## Create a rollout

To get an image onto a robot you'll need to create a rollout, this associates images to robots.


## Provisioning a robot with the agent

You'll then need to ensure the agent has the proper credentials and configuration required for it to run and securely communicate with the backend.


## Running the agent

Finally you can run the agent.
# User guide

This guide is for users/practitioners that want to set up and use Airbotics, but not develop it. Here are the main steps:

## Create a Root CA

This will create a public and private key for the root CA and store them in the key server. It will also create a cert and store it in blob storage under the `root` bucket.

```
npx ts-node scripts/manage-ca-cert.ts create
```

When tearing down the infrastructure you can delete them using

```
npx ts-node scripts/manage-ca-cert.ts delete
```

## Stand up postgres

```
docker compose up postgres
```

You'll have to migrate or `npx prisma db push --schema ./src/prisma/schema.prisma` after this.

## Initialise a namespace

```
POST <BASE_URL>/api/v0/admin/namespaces
```

This will return a namespace id plus some other basic information.

## Download provisioning credentials

This will allow robots to provision themselves

```
wget -O credentials.zip http://localhost:8001/api/v0/admin/namespaces/<namespace-id>/provisioning-credentials
```

You can list the contents of the zip with:

```
unzip -l ../credentials.zip
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

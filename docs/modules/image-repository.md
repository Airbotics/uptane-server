# Image repository module

The image repository is responsible for storing images and their (TUF) metadata. 

There are three main mutations performed against it:

1. Initialisation

When a namespace is initialised (in the admin module) it will create an initial `root.json` metadata file that will be stored in the image repository using the keys that were created as part of the namespace creation.

2. Adding an image

When an image for an ECU has been built and is ready to be deployed to the fleet it will be uploaded to Airbotics by an admin. When Airbotics ingests it, it will:
- Add a record to Postgres with general metadata about it (who uploaded it, unique id, hashes, size, etc.).
- Write it to blob storage (and later treehub).
- Create a new set of TUF metadata using the image repo's online keys (targets, snapshot, timestamp) and make this new version available for download.

2. Re-signing

Before the TUF metadata for the image repo expires it should be resigned. Currently, this happens with a background worker.

There are two main queries that can be made against it:

1. List images

This allows an admin to read a full list of images that have been uploaded.

2. Download an image

This allows an ECU to download the content of an image that has been uploaded by an admin. Each image is referenced by a unique id, an ECU can fetch it from `<BASE_URL>/images/<id>` or prepend the the hash of the image to the id, i.e. `<BASE_URL>/images/<hash>.<id>`.


## Storing images

Currently, images are uploaded and stored in blob storage. In time they will also be stored in treehub.
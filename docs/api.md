# API

Airbotics exposes a REST API over HTTP. Media (MIME) types are either JSON (`content-type: application/json`) or arbitrary binary data (`content-type: application/octet-stream`) depending on the endpoint.

The base URL of the hosted version is: `https://api.airbotics.io/`. The base URL of the self-hosted version is up to you.

After that comes the version of the API being used, versions are of the form `v0`, `v1`, etc. See below for versions.

## Versions

- `v0 (latest)`: Alpha version

## Methods

The convention we follow is:

PUT - for upserting

POST - for creating

GET - for reading

DELETE - for deleting

## Responses

Respones either contain the data being requested or a message indicating what action has been taken or what error occured. Error responses contain as little information as possible since we're optimising for security, not user-friendliness. E.g. _could not upload image_ instead of _could not upload image because the wrong content-type was sent_.

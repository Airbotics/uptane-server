# Airbotics Docs

Airbotics is an open-source DevOps platform for robotics.


## TUF metadata expiration

By default, TUF metadata expires according to the following schedule. This can be configured.

| Repository | Role      | Expiration (days) |
| ---------- | --------- | ----------------- |
| Director   | Root      | 365               |
| Director   | Targets   | 1                 |
| Director   | Snapshot  | 1                 |
| Director   | Timestamp | 1                 |
| Image      | Root      | 365               |
| Image      | Targets   | 365               |
| Image      | Snapshot  | 1                 |
| Image      | Timestamp | 1                 |


## Limitations

Airbotics is a work-in-progress is not yet full compatible with the Updane specification, some of these limitations will be addressed over time. 

Current limitations:
- No support for secondary ECUs.
- Only supports full verification ECUs.
- Only supports online, asymmetric RSA keys.
- No support for key revocation.
- Only one key per role in each repository.
- Images are not encrypted.
- No support for delegations.
- No delta updates.
- No support for rollbacks yet.
- No support for adding/updating/removing ECUs.
- No support for removing images from the image repository.
- One image per ECU.
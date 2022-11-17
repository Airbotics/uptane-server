# Airbotics Docs


## Contents

- [User guide](user-guide.md)

- [Developers guide](developers-guide.md)

- [Architecture](architecture.md)

    - [Admin module](modules/admin.md)

    - [Director repository module](modules/director-repository.md)

    - [Image repository module](modules/image-repository.md)

    - [Treehub module](modules/treehub.md)

    - [Background workers](modules/background-workers.md)

- [Key management](key-management.md)

- [API](api.md)
- [Scripts](scripts.md)


## Concepts / Glossary

### Namespace

A _namespace_ is a logical collection of all resources related to a project. Resources could be TUF metadata, ecus, manifests, images, etc.

### TUF

_TUF_ stands for [The Update Framework](https://theupdateframework.com/), of which Uptane is an extension.

### Admin

A human _adminstrator_ responsible for managing Airbotics, e.g. an engineer at a robotics company.

### Robot

A _robot_ is a machine on which Airbotics will update software. It can contain multiple ECUs. Updane calls these machines vehicles instead. We say robot, but really it could be anything.

### ECU

An _ECU_ is an Electronic Control Unit, i.e. a computer.

### Images

_Images_ is a general term referring to artifacts that should be deployed to ECUs, e.g. full OS images, built binaries, configuration files, maps, Docker images. At its most basic, images are a collection of files.

### Rollout

Images are assigned to ECUs on robots through _rollouts_, i.e. they associate a set of images for a set of ECUs. Rollouts are used by the director repository to determine if a robot's software is up-to-date or not. 


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

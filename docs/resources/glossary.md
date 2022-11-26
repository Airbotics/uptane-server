# Glossary

**Namespace**

A _namespace_ is a logical collection of all resources related to a project. Resources could be TUF metadata, ecus, manifests, images, etc.

**TUF**

_TUF_ stands for [The Update Framework](https://theupdateframework.com/), of which Uptane is an extension.

**Admin**

A human _adminstrator_ responsible for managing Airbotics, e.g. an engineer at a robotics company.

**Robot**

A _robot_ is a machine on which Airbotics will update software. It can contain multiple ECUs. Updane calls these machines vehicles instead. We say robot, but really it could be anything.

**ECU**

An _ECU_ is an Electronic Control Unit, i.e. a computer.

**Images**

_Images_ is a general term referring to artifacts that should be deployed to ECUs, e.g. full OS images, built binaries, configuration files, maps, Docker images. At its most basic, images are a collection of files.

**Rollout**

Images are assigned to ECUs on robots through _rollouts_, i.e. they associate a set of images for a set of ECUs. Rollouts are used by the director repository to determine if a robot's software is up-to-date or not. 

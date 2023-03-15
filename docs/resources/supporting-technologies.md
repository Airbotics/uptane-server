# Supporting technologies

Airbotics is built on several mature, well-tested, open-source technologies enabling us to provide secure and stable updates.

## Uptane

[Uptane](https://uptane.github.io/) is an extension of [The Update Framework](https://theupdateframework.com/) (TUF) designed for securing software update systems in the automotive industry. It was initially developed by a consortium of industry, academic and goverment agencies under a grant from the U.S. Department of Homeland Security. Popular Science named Uptane one of the [Top Security Inventions of 2017](https://www.popsci.com/top-security-innovations-2017/), and since 2019 is has been formally affiliated with the Linux Foundation as a [Joint Development Foundation](https://jointdevelopment.org/) project. 


Uptane is integrated into [Automotive Grade Linux](https://www.automotivelinux.org/) is used by about 1/3 of new cars on US roads [[1]](https://events19.linuxfoundation.org/wp-content/uploads/2018/07/Uptane-2019-Summer-AGL-event.pdf). TUF is used to secure millions of system and has been adopted by Docker Content Trust, PyPI, Datadog, and many others.

Building on this framework allows us to ensure your robots are receiving updates securely.


## OSTree

[OSTree](https://ostree.readthedocs.io/en/latest/) is an upgrade system for Linux-based operating systems that performs incremental atomic upgrades of complete bootable filesystem trees.

It has severals benefits:
- Unlike dual-bank (i.e. A/B partitioning) update strategies, you don't need to overspec storage.
- It downloads deltas between versions, saving bandwidth.
- It can store `n` versions.
- Updates are fully atomic and safe to power failures.

OSTree is used in [Flatpak](https://flatpak.org/) and several Fedora derivatives. 


## Aktualizr

[Aktualizr]([https://github.com/uptane/aktualizr]) is an open-source C++ implementation of an Uptane client with integrations for OSTree. It was originally developed by [ATS Advanced Telematic Systems](https://github.com/advancedtelematic) and is used as the foundation for several commercially available implementations of Uptane. It is used in the [meta-updater](https://github.com/advancedtelematic/meta-updater) Yocto layer allowing for OTA updates of Yocto-built OSTree-complaint images.

The Airbotics client is built around libaktualizr with extensions for ROS and other communication protocols.


## Yocto
[Yocto](https://www.yoctoproject.org/) (or The Yocto Project) is an open-source collection of tools for building custom Linux-based distributions. It supports a wide array of architectures and platforms and software technologies such as [ROS](https://github.com/ros/meta-ros), [Zephyr](https://layers.openembedded.org/layerindex/branch/master/layer/meta-zephyr/), [FreeRTOS](https://layers.openembedded.org/layerindex/branch/master/layer/meta-freertos/), [Automotive Grade Linux](https://layers.openembedded.org/layerindex/branch/master/layer/meta-agl/), and tonnes more. It has been a [Linux Foundation](https://www.linuxfoundation.org/) project since 2010.

It allows for fine-grain customisation of systems but has a steep learning curve, for this reason we provide a reference distribution to get started.

<!-- 
## ROS

[Robot Operating System ](https://www.ros.org/) (ROS) is the de facto standard framework for developing software in robotics. It has been actively developed since 2007 and is widely used in production on some of the largest robotics fleets. At its core, it provides a set of tools allowing programs in a robot to share data. 

The Airbotics agent has an optional API with ROS 1 and 2 allowing for straightforward integration with existing ROS codebases.

## Docker

[Docker](https://www.docker.com/) is a virtualisation technology which helps simplify developer workflows. With it, developers can isolate their programs and dependencies minimising conflicts and making portability easier. Docker provides tooling to make this process relatively straightforward. Docker is widely-used across industries and has many years worth of cumulative server hours being used in large production environments.

Building on Docker (and/or other containerisation technologies) allows robotics engineers using Airbotics to keep their workflow relatively simple, making it easier to test and share their work while it is in development before being shipped to production. -->
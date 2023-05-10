# AirOS

[AirOS](https://github.com/Airbotics/AirOS) is a template for building full OS images that work out of the box with Airbotics cloud. It includes all the necessary [yocto layers](https://docs.yoctoproject.org/dev/dev-manual/layers.html) required to build a bootable OS image with OTA capabilities. 

AirOS is our recommended starting point for anyone wanting to try out Airbotics, however if you want to roll your own OS you are more than free to do so.

## Getting started

The [AirOS repo](https://github.com/Airbotics/AirOS) is designed to be forked into either your personal or your organisations Github account. From there you can clone the forked repo onto your development machine and begin read more about:
- How to configure the build for [secure OTA](./configure-ota.md). 
- How to configure the build for your [hardware](./configure-hardware.md).
- How to configure the build to integrate your [application](./configure-app.md).

## Quickstart
If you're looking for the quickest way to take AirOs and Airbotics for a spin check out the [quickstart guide](../guides/quickstart.md).

## Supported hardware

Due to the way OTA updates work with Airbotics it requires us to add support on a per board basis. We are working hard to support as many boards as possible. Please open an issue if you want to see support for your board.

As of now we have support for:

- The QEMU emulator
- Raspberry Pi 3
- Raspberry Pi 4

In progress:

- Rockpi 4B

## Features
 - Fully bootable OS with minimal set of utilities including [busybox](https://busybox.net/about.html) and [systemd](https://systemd.io/).
 - Highly secure OTA updates with Airbotics. 
 - Ability to install your your application artefacts into a built image. 

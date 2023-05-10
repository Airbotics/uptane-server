# Configuring build for your hardware

The default configuration for AirOS is to build an image that is compatible to run with the QEMU emulator. This works well for evaluation purposes but there comes a time when you will want to build an image to run on some real hardware.

Two things need to be in place for AirOS to work with your boards:

1. There must be a [BSP (Board Support Package)](https://docs.yoctoproject.org/bsp-guide/bsp.html) available for your chosen board, this is usually provided by the OEM.
2. Ensure your board is on our list of [supported boards](#supported-boards). 


## Adding a Board Support Package

Adding a BSP will involve cloning another layer (the BSP itself) into the top level directory of AirOS and making a modification to `build/conf/bb.layers.conf` to give yocto access to all its recipes. 

Instructions will vary between BSPs, we recommend referencing the documentation provided by the BSP developers.


## Build configuration

You will also need to update the `build/conf/local.conf` and change the `MACHINE` variable to specify the hardware architecture you are building for.

The `MACHINE` variable should match one of the machine configurations provided by a Board Support Package (BSP) layer included in your build.

A machine configuration file usually includes settings specific to a particular hardware platform, such as the kernel configuration, the type of image to build, and any hardware-specific packages that need to be included in the image.

For example, if you were building for a Raspberry Pi 3, you might set the MACHINE variable like this:

```
MACHINE = "raspberrypi3"
```


## Supported boards

Due to the way OTA updates work with Airbotics it requires us to add support on a per board basis. We are working hard to support as many boards as possible.

As of now we have support for:

- The QEMU emulator
- Raspberry Pi 4
- Raspberry Pi 4

Coming soon:

- Rockpi 4B

If your board is not there please take out an issue and we will try and add support as quickly as we can.
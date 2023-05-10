# AirOS

[AirOS](https://github.com/Airbotics/AirOS) is a template for building full OS images that work out of the box with Airbotics cloud. It includes all the necessary [yocto layers](https://docs.yoctoproject.org/dev/dev-manual/layers.html) required to build a bootable OS image with OTA capabilities. 

[AirOS](https://github.com/Airbotics/AirOS)  is our recommended starting point for anyone wanting to try out Airbotics, however if you want to roll your own OS you are more than free to do so.    

If you're looking for the quickest way to take AirOs and Airbotics for a spin check out the [quickstart guide](../guides/quickstart.md).

## Getting started

To get started with [AirOS repo](https://github.com/Airbotics/AirOS) you can complete the following steps:


1. Fork the [AirOS repo](https://github.com/Airbotics/AirOS) to either your personal or your organisations Github account.
2. Clone the forked repo to your development machine.
3. Run `make init` to fetch the required git submodules.
4. Run `source ./poky/oe-init-build-env build` to set up your build envirnoment. 
5. Enable [OTA updates](./enable-ota.md)

After completing these steps you should now have the bare minimum you need to start building your own OS image. 

You should note that minimum really means minimum, if you make no further changes from this point, an image you build will contain only a basic set of packages.


## Next steps

We recommend you read the [anatomy of AirOS](./anatomy.md) to gain a better understanding of the components of AirOS. After that you can move on to:

1. How to [enable OTA functionality.](../airos/enable-ota.md) 
2. How to [adding your application code](./add-app.md) into an image. 
# Images

## Building images

Software images for Airbotics are built using [Yocto](https://www.yoctoproject.org/). They are full system images containing an operating system, drivers, application code and anything else your robot needs. They are based on [OSTree](https://www.yoctoproject.org/) to provide **incremental and atomic upgrades**.

<!-- you can read more about the advantages and disadvantages of ostree here -->

Images cannot be modified once they have been uploaded to Airbotics, to make a modification you'll need to build a new one.

Once an image has been built, signed and uploaded to Airbotics you will be able to see information about it on the dashboard.

![Image description.](../imgs//image-description.png)


### Including meta-updater in your Yocto build

The source code for meta-updater can be found on [GitHub](https://github.com/uptane/meta-updater), you'll need to clone it and add it to your `bblayers.conf` file.

After that you will want to change the distro in the `conf/local.conf` to `poky-sota-systemd`. You'll then need to include the build arguments listed in the next section.

### Supported build arguments

You can modify the behaviour of meta-updater by specifying variables in the `conf/local.conf` file of your Yocto build.

The following build arguments for meta-updater are supported:

| Level                     | Description                                            |
| ------------------------- | ------------------------------------------------------ |
| `SOTA_PACKED_CREDENTIALS` | Absolute path to provisioning credentials, e.g. `/home/user/path/to/credentials.zip` |
| `SOTA_HARDWARE_ID`        | Type of hardware ID this image can be deployed to, e.g. `nvidia-jetson`, `motor-controller-ecu` |
| `SOTA_POLLING_SEC`        | How often the agent should poll for updates in seconds, e.g `86400` |

> Note: modifying other variables could break Airbotics.

<!-- OSTree
hardware
size
meta-updater
supported boards
storage - security, limit, stored in EU
description -->

## Storage

Images are stored on Airbotics infrastructure hosted in the EU and are encrypted at rest.


## Deleting images

Images cannot be deleted as of now, this is something we're working on.
# Configuring build for OTA updates

You will need to include a credentials zip in your image. You can read more about provisioning credentials in the [Airbotics docs](https://docs.airbotics.io/platform/provisioning-credentials). You can create and download your `credentials.zip` from the [dashboard](https://dashboard.airbotics.io/team/provisioning-credentials).

The `credentials.zip` serves two main purposes:

1. Enables the built image to be uploaded to the Airbotics cloud.
2. Enables robots that are flashed with the built image to authenticate and provision themselves with the Airbotics cloud and check for OTA updates.

You will need to update the `build/conf/local.conf` to tell yocto where to find the `credentials.zip`.


Set the `SOTA_PACKED_CREDENTIALS` in your `local.conf` to the **absolute** path of your `credentials.zip`. Here is an example:

```
SOTA_PACKED_CREDENTIALS = "/home/bob/AirOs/credentials.zip"
```

Also ensure that the `DISTRO` in your `local.conf` is set to:
```
DISTRO = "poky-sota-systemd"
```

With these variables set the next time you perform a `make build`, bitbake will upload the built image to the Airbotics cloud. 

If you flash the built image to a robot (or use an emulator), the robot will provision itself in the Airbotics cloud. You can check your provisioned robots on the [dashboard](https://dashboard.airbotics.io/robots).
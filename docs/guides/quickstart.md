## Quickstart
In this guide we'll take Airbotics Cloud for a spin by building an OS image based on [AirOS](../airos/overview.md)

## Prerequisites
- A Linux-based machine with plenty of storage, compute and memory.
    - ~100GB disk space
    - At least 8GB of RAM
- An account with Airbotics, you can create one [here](https://dashboard.airbotics.io/register).


## Build an image
1. Fork the [AirOS repo](https://github.com/Airbotics/AirOS) 
2. Clone the forked repo onto your development machine.
3. Create and download [provisioning credentials](https://dashboard.airbotics.io/team/provisioning-credentials) from the Airbotics dashboard and place `credentials.zip` in the top level directory.
4. Install Yocto dependencies. We recommend checking the [official source](https://docs.yoctoproject.org/3.2.3/ref-manual/ref-system-requirements.html). You can use our installer script if you wish:
```
.scripts/install-yocto-deps.sh
```
5. Set `SOTA_PACKED_CREDENTIALS` in `build/conf/local.conf` to the absolute path of your `credentials.zip`
6. Initialise all the required git submodules:

```
make init
```

7. Initialise the build envirnoment and start the build:

```
make build
```

> This could take upwards of 1 hour on the first run depending on the specifications of your build machine.

8. When the build is finally complete you should be able run the image with the [QEMU](https://www.qemu.org/) emulator:

```
make emulate
```

> The default username is `root` and is passwordless.

You should now see your built image on the [images](https://dashboard.airbotics.io/images) page of the Airbotics dashboard.

## Rollout an OTA update

1. Our first image is pretty basic, it doesn't even have vim! Let's add it:

```
echo 'IMAGE_INSTALL_append = " vim "' >> build/conf/local.conf
```

2. Build the updated image:

```
make build
```

> Note: This should take a fraction of the time that it did on the first build.

3. Verify the [images](https://dashboard.airbotics.io/images) page of the Airbotics dashboard now contains two images, our initial build and our second one that has vim installed.

4. From the [rollouts page](https://dashboard.airbotics.io/rollouts) page of the dashboard, create a new rollout.
    - Give it a name and description.
    - Target the rollout at specific robots (just one for now).
    - Check *should be updated* for *ECU Hardware ID:* `qemux86-64`.
    - Select the *update to image* as the one that has vim installed.
    - Review and create

5. Click on the newly created rollout and click *launch*.

6. Keep an eye on the rollout status on rollout details page, within a few minutes your *robot* should have updated itself.

7. Once the status changes to *completed*, you can reboot the emulator:

```
reboot
```

Once it reboots you should now be able to use vim. You'll see the ECU, Robot and Rollout status has changed. Nice 😎
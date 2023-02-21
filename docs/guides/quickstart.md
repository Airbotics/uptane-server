# Quickstart

In this guide we'll take Airbotics Cloud for a spin, we will:
- Build a full system image using Yocto and push it to Airbotics.
- We'll then flash the first image onto an emulated device and run it.
- We'll then make a new version of the image and push it again.
- Finally, we'll use the dashboard to update the device to the new version "over-the-air".

To complete this guide you'll need:
- A Linux-based machine with plenty of storage, compute and memory.
- An account with Airbotics, you can create one [here](https://dashboard.airbotics.io/register).
- A large coffee.

Let's go! 🚀

## 1. Download your provisioning credentials

The first thing to do after creating your account is download your provisioning credentials from the [dashboard](https://dashboard.airbotics.io/team/provisioning-credentials). You've have to input an expiry date for them, it may take a few seconds for them to be issued.

Provisioning credentials are used to upload software images to Airbotics and to provision your robots, they come in a `credentials.zip` file.

> More: You can read more about managing credentials [here](#).


## 2. Build an image

Now we'll build a full system image using [Yocto](https://www.yoctoproject.org/) - a set of tools for building embedded images. You'll need a relatively powerful computer to do this, the requirements for runnnig Yocto can be found [here](https://docs.yoctoproject.org/3.2.3/ref-manual/ref-system-requirements.html).

For this guide we'll build a basic image on top of the referenece distribution [Poky](https://www.yoctoproject.org/software-item/poky/), we will build it without vim and later create a new version that does contain vim.

To integrate with Airbotics you will need to add the [meta-updater](https://github.com/uptane/meta-updater) layer, this contains the agent, OSTree, and other magic. After this guide, you can add more layers with everything your robot needs by creating your own or importing [pre-built](https://layers.openembedded.org/layerindex/branch/master/layers/) ones.


In the `conf/local.conf` of the meta-updater layer you will need to modify the `SOTA_PACKED_CREDENTIALS` value to be the absolute path pointing to wherever you download your credentials.

At this point you can build the image with:

```
bitbake core-image-minimal
```

> Note: the first time you do this it can take as long as an hour. This could be a good time to get that coffee.


When the image finishes building meta-updater will sign upload it to Airbotics. You'll then be able to see it in the [images](https://dashboard.airbotics.io/images) page on the dashboard. Click into the image and change its description to something like _Quickstart image v1 - does not contain vim_.

> More: You can read a more detailed tutorial about building images [here](#) including how to pin images to certain compatible boards.


## 3. Flash your image to a robot

Now that we have a shiny new image with everything our robot needs we'll flash it to our "robot". To simplify things, we'll use the [QEMU](https://www.qemu.org/) emulator instead of a physical board.

We'll "flash" and boot the "robot" by running the following command:

```
../meta-updater/scripts/run-qemu-ota --overlay quickstart-robot.cow
```

Once it boots the agent will automatically provision itself with Airbotics and genreate a random ID. From the command line in QEMU you can manually check which version is running with the command below:

```
ostree admin status
```

You can also confirm that vim is not found by running `vim` which should produce a nice error message.

If you heaad to the [robots](https://dashboard.airbotics.io/robots) page of the dashboard you can see information about it your robot and confirm the correct version is running.


<!-- > More: You can read more about different boards [here](#), ostree commands, agent status. -->

----------------------------
## 4. Build a new version of the image

Great! Now we have a robot that's running an image we've built and is provisioned with Airbotics. Let's improve our software by adding vim to it. In the `conf/local.conf` of the meta-updater layer add the following line:

```
IMAGE_INSTALL_append = " vim "
```

and build it again using:

```
bitbake core-image-minimal
```

> Note: This should take a fraction of the time that it did on the first build.

After it builds we can see it in the [images](https://dashboard.airbotics.io/images) page of the dashboard, let's click into it and give it a description like: _Quickstart image v2 - contains vim_.

## 5. Roll out an update

So our engineers have been busy at work improving our codebase and we now have a brand new image that includes vim. Let's roll it out to our fleet.

We'll head to the rollouts page on the dashboard and create a rollout. We'll first choose our robot and then the new version of the image, and create it. We can monitor the status of the rollout from the dashboard.

With Airbotics, **updates only take place after a reboot**, you can confirm that although the update has been accepted by the robot it hasn't yet been applied by running this command on the board:

```
ostree admin status
```

We can also confirm vim isn't on the robot yet.

Now Let's reboot the board by exiting QEMU and running it again with `../meta-updater/scripts/run-qemu-ota --overlay mydevice.cow`. Once it boots you should now be able to use vim. Nice 😎

## 7. Cleaning up

If you don't intend to continue to use your credentials we recommend you revoke them in Airbotics dashboard and delete them from your computer. You can also delete the images and robot.

## Next steps

Now that you have completed a basic workflow here are some cool things you can do:

- [Group your robots](./groups.md).

- [Learn about the core concepts of Airbotics](../introduction/core-concepts.md).

- [Learn about the technologies Airbotics is built on](../introduction/supporting-technologies.md).
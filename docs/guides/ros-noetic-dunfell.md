# Yocto & ROS Intro 

In this guide we'll learn how to:
- Build a full system image using Yocto with open embedded release Dunfell that includes ROS 1 Noetic for the QEMU emulator.
- Boot the image and ensure ROS is installed correctly and we can start `roscore`.

In a later guides we'll learn:
- How to add some ROS nodes to our previously image.
- How to use containers with Yocto and ROS.
- How to build images for other hardware boards.
- How to put it all together and ship a full ROS application with Airbotics.

## Prerequisites
- A Linux-based machine with plenty of storage, compute and memory.
    - ~100GB disk space
    - At least 8GB of RAM
- The following dependencies 

```
sudo apt-get install 
    qemu gawk wget git diffstat unzip gcc-multilib \
    build-essential chrpath socat cpio python3-pip python3-pexpect \
    xz-utils debianutils iputils-ping \
    python3-git python3-jinja2 libegl1-mesa libsdl1.2-dev xterm \
    g++-multilib locales lsb-release python3-distutils time \
    liblz4-tool zstd file
```


## 1. Setup Envirnoment

Create a new directory for the demo workspace.
```
mkdir air-ros-demo
cd air-ros-demo
```

Clone the build files from `meta-ros` repo into build directory.
```
git clone -b build --single-branch https://github.com/ros/meta-ros.git build
```

Create a `conf` directory
```
mkdir conf
```

Create a symlink from the build/conf to conf
```
ln -snf ../conf build
```

Copy the build configuration for our required ROS distro and open embedded release series.
```
distro="ros1"
ros_distro="noetic"
oe_release="dunfell"
cfg=$distro-$ros_distro-$oe_release.mcf
cp build/files/$cfg conf
```

Run a helper script that will clone the required layers for the build. You'll also notice a `conf/bblayers.conf` has been created.
```
build/scripts/mcf -f conf/$cfg
```

Set up the shell envirnoment for the build. This will create our `conf/local.conf` and allow us to use bitbake.
```
source openembedded-core/oe-init-build-env
```

From the stdout you should see that you are now able to run bitbake and will find yourself in the build directory.

## 2. Prepare conf

A build produces many (large) build artifacts, some of which can be shared between different builds of OE and ROS distros. If you want save disk space between different builds with different distros you can create a common shared directory for build artifacts.

```
mkdir -p <abs-path-to-shared-directory>
```

We'll need this path again very soon when update our configuration. Open the `local.conf` from the `conf` directory.

```
air-ros-demo/conf/local.conf
```

Add the following to the end of the `local.conf` file, this includes all the ROS specific configuration we need. Don't forget to change the `ROS_COMMON_ARTIFACTS` to point to your absolute path from the previous step.

```
ROS_LOCAL_CONF_SETTINGS_VERSION := "3.0"

DISTRO ?= "${MCF_DISTRO}"

# The list of supported values of MACHINE is found in the Machines[] array conf/bblayers.conf
MACHINE ?= "qemux86"

ROS_DISTRO_VERSION_APPEND ?= "+${MCF_OPENEMBEDDED_VERSION}"

ROS_OE_RELEASE_SERIES_SUFFIX ?= "-${ROS_OE_RELEASE_SERIES}"

# TODO: REPLACE WITH YOUR PATH
ROS_COMMON_ARTIFACTS ?= "<abs-path-to-shared-directory>"

DL_DIR ?= "${ROS_COMMON_ARTIFACTS}/downloads"

SSTATE_DIR ?= "${ROS_COMMON_ARTIFACTS}/sstate-cache${ROS_OE_RELEASE_SERIES_SUFFIX}"

TMPDIR = "${@os.getenv('TMPDIR', '${ROS_COMMON_ARTIFACTS}/BUILD-${DISTRO}-${ROS_DISTRO}${ROS_OE_RELEASE_SERIES_SUFFIX}')}"

TCLIBCAPPEND := ""

BB_NUMBER_THREADS ?= "${@min(int(bb.utils.cpu_count()), 20)}"

PARALLEL_MAKE ?= "-j ${BB_NUMBER_THREADS}"

INHERIT += "rm_work"

EXTRA_IMAGE_FEATURES += "ros-implicit-workspace"

#Add bash to the install
IMAGE_INSTALL_append= " bash "
```

Save the file. You can adjust this file to include any other additions. Feel free to look at [yocto docs glossary](https://docs.yoctoproject.org/ref-manual/variables.html?highlight=glossary#term-EXTRA_IMAGE_FEATURES) more information.

## 2. Build the image

We are finally ready to build the image with bitbake. This may take anywhere from 30 mins to several hours on the initial build depending on the specs of your host machine.

Start the build with:
```
bitbake ros-image-core
```

If the build was successful you will be able to see the finished built images in
```
ROS_COMMON_ARTIFACTS/BUILD-ros1-noetic-dunfell/deploy/images/qemux86/
```

## 3. Boot the image
We  can utilise the Quick EMUlator (part of the Yocto project tool set and built on top of QEMU) to test our built image.

```
runqemu
```

The image will boot on the QEMU emulator, you should be taken to a log in prompt after the boot sequence. The password is set as `root`.

Lets first change our shell to bash
```
chsh -s /bin/bash
```


You should now be able to run:

```
source /opt/ros/noetic/setup.bash
```

And finally check that you can start `roscore`

```
roscore
```

## References

* [meta-ros OpenEmbedded-Build-Instructions](https://github.com/ros/meta-ros/wiki/OpenEmbedded-Build-Instructions)
* [Yocto Dev QEMU manual](https://docs.yoctoproject.org/dev-manual/qemu.html)
* [Yocto Ref manual](https://docs.yoctoproject.org/ref-manual/variables.html)
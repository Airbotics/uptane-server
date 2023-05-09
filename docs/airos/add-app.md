# Adding your application code

AirOS makes it easier for you to integrate your application code into an OS image by doing the work of copying your application artefacts into the root filesystem automatically. When we say *application artefacts* we are specifically talking about:

1. OCI container images
2. Systemd unit files
3. Scripts

This list of [supported artefacts](#supported-artifacts) will be extended greatly over the coming weeks and months.



## Add the `app-artifacts` recipe

Within AirOS there is a yocto layer called `meta-airbotics` and within that, there is a recipe `app-artifacts` that is responsible for parsing your [airbotics.yaml](#the-airboticsyaml-file) file and installing application artefacts onto the rootfs.

The first step is to open `build/conf/local.conf` and add the following:

```
IMAGE_INSTALL_append = " app-artifacts"
```

## Submodule your application repo

Next, you must [submodule](https://git-scm.com/book/en/v2/Git-Tools-Submodules) your application repository into the top level `app` directory.

Before you do this you must ensure your application repository contains a valid [airbotics.yaml](#the-airboticsyaml-file) file.  

This [airbotics.yaml](#the-airboticsyaml-file) file should be placed at the top level of your application repo. 

```
git submodule add -b main --depth 1 <remote-url> app
```

- You will have to change the `<remote-url>` to the URL of your repo.
-  Your `<remote-url>` should contain a valid [airbotics.yaml](#the-airboticsyaml-file) file. 
- You must ensure you are authenticated to pull the repo from `<remote-url>`.
- You will have to specify the branch you wish to be included by changing the `-b` argument.
- If your application repo contains submodules you will have to adjust the `--depth` argument


> To see an example of an application repo please see our [sample ros](https://github.com/Airbotics/sample_ros1_ws) repo.

> Do not make changes to your `app` folder here, instead make them in the original repo, when you want to pull the latest changes, from the root you may run: `git submodule update --init --recursive app`






### The `airbotics.yaml` file

Here is an example of a valid `airbotics.yaml` file:

```
containers:
  private:
    - 
      dockerfile: cpp_package/Dockerfile
      name: talker
      tag: latest
    - 
      dockerfile: py_package/Dockerfile
      name: listener
      tag: latest
  public: 
    -
      repo: registry.hub.docker.com/library
      name: ros
      tag: noetic-ros-core
systemd_units:
  - systemd_units/image-load.service
  - systemd_units/container-load.service
  - systemd_units/ros.service
  - systemd_units/listener.service
  - systemd_units/talker.service
scripts:
  - scripts/image-load.sh
  - scripts/container-create.sh
```

This file will do the following
* Build and copy 2 container images
    - `talker:latest` from a dockerfile located at `/app/cpp_package/Dockerfile`
    - `listener:latest` from a dockerfile located at `/app/py_package/Dockerfile`
* Pull, build and copy 1 container image:
    - `ros:noetic-ros-core` from the official dockerhub registry
* Copy 5 systemd unit files from `app/systemd_units/containers.service`
* Copy 2 scripts from `app/scripts/container-run.sh`


## Supported artifacts

The currently supported artifacts are:
1. OCI container images
2. Systemd unit files
3. Scripts
4. *many more coming soon*

### OCI Container Images

These will be built using `docker` on your build machine and installed onto the rootfs of your image in the `/usr/share/container-images` directory. When the image is booted you can use these images like any other image. We use podman for container management.

### Systemd units

These can be used as a process manager for your containers. All services will be installed into `/lib/systemd/system` directory and enabled so they run automatically on boot.


### Scripts

These can be called by a systemd unit to load and start containers, or any other usecase you see fit. Scripts are written to the `/usr/bin/` directory on the rootfs.

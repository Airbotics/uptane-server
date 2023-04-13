# Yocto Mini-Series: II - Adding your own code

This is the second part of our mini-series on working with Yocto. We are assuming you've already got your host machine setup with the required base layers.

In this guide we'll learn how to:
- Create a new yocto layer ourselves.
- Create a new recipe which contains some _hello world_ code.
- Rebuild our image and ensure our _hello world_ binary gets installed on the rootfs.

In the next guide we'll learn how to:
- How to use containers with Yocto and ROS.

## 1. Create a new layer
Up until now we've been utilising layers written by others but there comes a time when we need to get our own source code and configurations into our image.

The easiest way to create a new layer is with the help of the `bitbake-layers` script that will automate the process of updating the project config and creating the relevant files and directories.

Make sure you're back in the `build` directory of the build machine and you've initialised the build envirnoment with:
```
source openembedded-core/init-build-env
```

Create a new layer:
```
bitbake-layers create-layer ../meta-air-demo
```

Add the new layer to our build configuration:

```
bitbake-layers add-layer ../meta-air-demo
```

You can confirm the layer was picked up correctly by running:

```
bitbake-layers show-layers
```


## 2. Create a new recipe inside the layer
To actually get our source code built and onto our image, we need to create a _recipe_. A yocto recipe is analogous to a real life recipe. 

In real life a recipe tells us what food to buy, where to buy it from, how to prepare it, how to mix it, and how to cook it. 

A yocto recipe does much the same thing, but rather than steps that refer to food, they refer to code: fetch source, extract source, configure build, perform build, install build, post-install scripts etc.

If we take a look at the directory structure in our new layer, you will see the following, notice how an example `recipes-example` recipe was already created:
```
meta-air-demo/
├── conf
│   └── layer.conf
├── COPYING.MIT
├── README
└── recipes-example
	└── example
    	└── example_0.1.bb
```

The `conf/layer.conf` file tells yocto to pick up any recipes the layer root directory that start with the name `recipes-`. Within the `recipes-*` directory, there **must** be another directory that contains the recipe.

Let's create a new recipe which we'll call `recipes-hello-air`.
```
mkdir -p ../meta-air-demo/recipes-hello-air/hello/files
touch ../meta-air-demo/recipes-hello-air/hello/hello_1.0.bb
```

Next we'll add our source code. Often source code will be pulled in from a remote but in this example, our recipe uses a locally available source code. Following yocto conventions you should put this source code in a directory named `files`.

Create a new file for our source code:
```
touch ../meta-air-demo/recipes-hello-air/hello/files/air-hello.c
```

Copy the following into `air-hello.c` with our hello world code:

```
#include <stdio.h>

int main(void) {
    printf("Hello, from airbotics!\n");
    return 0;
}
```

Now we need to construct the recipe file itself. Open the `meta-air-demo/recipes-hello-air/hello_1.0.bb` and paste the following:

```
DESCRIPTION = "A demo for the Airbotics Yocto Mini-Series guide"
HOMEPAGE = "https://airbotics.io"
LICENSE = "MIT"
LIC_FILES_CHKSUM = "file://${COMMON_LICENSE_DIR}/MIT;md5=0835ade698e0bcf8506ecda2f7b4f302"


SRC_URI = "file://air-hello.c"

S = "${WORKDIR}"

do_compile() {
	${CC} ${LDFLAGS} air-hello.c -o air-hello
}

do_install() {
	install -d ${D}${bindir}
	install -m 0755 air-hello ${D}${bindir}
}
```


If you've followed all the steps in this section, your directory tree for the new layer should look like this:
```
../meta-air-demo/
├── conf
│   └── layer.conf
├── COPYING.MIT
├── README
├── recipes-example
│   └── example
│       └── example_0.1.bb
└── recipes-hello-air
    └── hello
        ├── files
        │   └── air-hello.c
        └── hello_1.0.bbl
```

## 3. Include the new recipe in the build
At this stage, yocto knows about our new layer and our new layer knows where to find our new recipe. The final step is to install it.

Open the `conf/local.conf` from the project root and add the following line:

```
IMAGE_INSTALL_append_pn-ros-image-core = " hello "
```

Now build the image again and the new image should contain our `hello` recipe.
```
bitbake ros-image-core
```

## 4. Test out the new image

If the image built successfully you should be able to boot the image again with:
```
runqemu
```

Now test if our hello world recipe worked:

```
air-hello
```

If everything worked you should be presented with the stdout:
```
Hello, from airbotics!
```

Great job, you can now add your own source code to a yocto image 😎
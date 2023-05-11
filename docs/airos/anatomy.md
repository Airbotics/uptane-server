# Anatomy of AirOS

In this section we'll explain the structure of the AirOs repo and the responsibility for each component. 

### Top level overview
The top level directories can be seen below. We **highly** recommend you do not touch any of the files in the *DON'T TOUCH LAYERS* unless you are completely aware of what you are doing.

```
├── app                         <----- YOUR APP REPO -----
├── build                       <----- IMAGE CONFIGURATION -----
├── meta-airbotics              <----- AIRBOTICS LAYER -----
├── meta-openembedded           <----- DON'T TOUCH LAYER -----
├── meta-security               <----- DON'T TOUCH LAYER -----
├── meta-updater                <----- DON'T TOUCH LAYER -----
├── meta-updater-qemux86-64     <----- DON'T TOUCH LAYER -----
├── meta-virtualization         <----- DON'T TOUCH LAYER -----
└── poky                        <----- DON'T TOUCH LAYER -----
```


`build` is the main working directory for the build process. It contains your builds configuration files as well as build artifacts and caches.

`meta-airbotics` is a yocto layer from Airbotics that can be used to copy artifacts, such as docker containers, systemd units and scripts from your application repositories into the built image.

`app` is the home of your application repository that you should [submodule](https://git-scm.com/book/en/v2/Git-Tools-Submodules). It should also include an `airbotics.yaml` in its top level. You can learn how to submodule your app in the [integrate your application](./add-app.md) section.

<br>

### The `build` directory
You will spend most of your time in this directory, specifically the `build/conf` directory. 

It is here where you can define, what layers you would like to include in your build, for example you might add a board support package depending on what hardware you are targeting. The template already includes the core layers you'll need to have to get a basic image built and running. 

You can 

```
build
└── conf
    ├── bblayers.conf           <----- DEFINE YOUR LAYERS -----
    ├── local.conf              <----- DEFINE YOUR CONFIG -----
    └── templateconf.cfg
```

<br>

### The `app` directory
The `app` directory contains your application repo as a [submodule](https://git-scm.com/book/en/v2/Git-Tools-Submodules). This repo can also contain other submodules if you desire. This repo **must** include an `airbotics.yaml` file if you want the artifacts from your application repositories to be included as part of the built image.

The `app` directory may look like this after you submodule your `sample-app` repo.
```
app                             <----- YOUR SUBMODULED APP -----
├── airbotics.yaml              <----- MUST BE INCLUDED -----
├── cpp_package
│   ├── CMakeLists.txt
│   ├── Dockerfile
│   ├── entry_script.sh
│   ├── package.xml
│   └── src
├── scripts
|   └── container-run.sh
└── systemd_units
    └── containers.service
```
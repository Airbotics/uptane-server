# Core Concepts

In this page we introduce the main concepts you'll need to know about in order to use Airbotics.

### Team

A _team_ is a collection of members (users). All resources belong to teams, resources could be robots, TUF metadata, ECUs, manifests, images, etc. etc.


### Robot 

A _robot_ is a networked machine for which Airbotics could update software. It could be a robot, a drone, a vehicle, or really any collection of edge, computers that need to be managed together. > Note

> Note: These are called vehicles in the Uptane spec.


### Groups

Robots can be arranged into _groups_, these contain one or more robots that can be managed together. A Robot does not have to be in a group and it can be a member of multiple groups at the same time. Groups can be used for different purposes, e.g. grouping all test robots, Beta Release robots, production robots, customer sites, etc. together to be managed at once.



### ECU

An _ECU_ is an Electronic Control Unit - a computer. It could be multi-core x86 board, a GPU accelerator, or an MCU - anything really.

There are two types of ECUs in Airbotics:

- **Primary ECU**

This is the “main” board on each robot, it communicates with the backend, fully verifies the integrity of all deployments, and downloads artifacts on behalf of other ECUs. There is always one and only one Primary ECU on each robot, any other ECUs are secondary ECUs. The primary ecu runs the Airbotics agent to mange communication with the backend.

- **Secondary ECU**

These are other (typically less powerful) computers on a robot. They do not communicate directly with the backend, and communicate with the Primary ECU instead. They still perform verification of deployments. Secondary ECUs may be powerful enough to run the airbotics agent in secondary mode, or if they are a smaller MCU, could include the airbotics library in its binary.


### Airbotics agent

The _Airbotics agent_ is an open-source program that runs on ECUs and handles connecting and authenticating with the backend; downloading, verifying and installing artifacts; and communicating the results of these actions to other programs on the ECU through various APIs (e.g. ROS). It is open-source and written in C++ on top of libaktualizer. It runs as a daemon service which we recommend managing using systemd.

### Rollouts

Artifacts are assigned to ECUs on robots through _rollouts_, i.e. they associate a set of artifacts for a set of ECUs. Rollouts are used by the director repository to determine if a robot's software is up-to-date or not.
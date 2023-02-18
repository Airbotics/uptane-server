# Introduction

Airbotics is an open-source software deployment platform for robotics, with features like native ROS support, pull-based updates, support for updating embedded ECUs, all built on top of a state of the art security framework.



## Different ways to use Airbotics

Airbotics comes in two flavours:

* Airbotics Cloud:

Airbotics cloud is our hosted and managed version of the Airbotics open-source platform. It always runs the latest version deployed to AWS in the EU and is managed, secured, scaled and monitored for you. We recommend Aibotics Cloud for the majority of users as it's the easiest way to get Airbotics running and is able to scale without requiring any changes from you. It also comes with 10 free robots.

* Self-hosted:

If you need to keep your data on-premise you can always self-host Airbotics, you can make modifications to it subject to our [license](https://github.com/Airbotics/airbotics/blob/main/LICENSE). Check out our guide for getting started with the self-hosted version [here](guides/self-hosting.md).


## How does it work?
Robots run the Airbotics agent which extends the [Aktualizr](https://github.com/uptane/aktualizr/) client allowing it to securley receive OTA updates from our [Uptane-compatible](https://uptane.github.io/) server implementation. Check out the component summary below to see which components are responsible for which task.


## Components

### Airbotics Agent
The Airbotics agent is the core piece of software that runs on each robot in your fleet. It runs as a system service that can be auto started after a robot provisions itself. At it's core the agent extends the [Aktualizr](https://github.com/uptane/aktualizr/) client which allows it to download and install OTA updates. The agent maintains the integrity and confidentiality of the OTA update in transit as all communication is performed over mutual TLS. The agent is capable of performing updates not only to the primary computer on the robot, but also to any secondary boards that may be present such as satellite microcontrollers or GPU boards. Native integration with the Robot Operating System [ROS](https://www.ros.org/) is also built in. This allows you to directly make ROS action calls from your application code to the Airbotics agent, enabling pull-based updates. As an example, you could write some application logic to make a service call to the agent to check for any updates while the robot is in its charging dock and has strong network connectivity. The agent can also perform rollbacks in the event of unsuccesfull updates and provides a steady stream of telemetry data in real-time.


### Dashboard
The Dashboard is the control plane between your team, your software and your fleet of robots. It is here where you can get full visibility into your fleet, which robots have which version of software, the status of any pending or ongoing updates and ways to roll out new updates to single robots, groups of robots or the entire fleet. You can hook up your code repository with Airbotics and have your build artifacts, whether they be Docker Images or full OS images show up straight away. From here you can group build artifacts into collections called *stacks* ready to be deployed. Your fleet can also be sliced and diced into *groups* of your choosing, robots can belong to as many different groups as you like. To get a stack onto the robot(s), you can create a *rollout* where you map which stack should go onto which robot(s), what to do in the case of an error (rollback or not), who should approve the rollout before it goes live, and much more.


### Image Repo
The Image Repo implements the [The Update Framework (TUF)](https://theupdateframework.io/) and handles the TUF metadata files that describe the list of the available images that could be downloaded. In this list it also provides hardware compatibility information, i.e. which harware IDs are compatible with each artifact. At it's core, it provides a **complete** list of known healthy images in your organisation along with the TUF metadata files that prove their authenticity, ensuring your that your robots can trust them.


### Director Repo
The Director Repo implements the server side of [Uptane framework](https://uptane.github.io/). This is the server that the robot mostly communicates with. The Aktualizr part of the agent can self-provision itself with the Director Repo and then is ready to be told which image from the Image Repo it should have installed. It does this by sending a report of itself to the Director Repo, which contains signed information about its current state, including what images it currently has installed. Using this report, the Director chooses which image (if any) should be installed. In Airbotics this is done by checking the current state of *rollouts*. If it is deemed that there is a more recent image available for the robot, new metadata is created containing information about these images. The agent will then run a detailed verification process, before attempting to pull and installed the new images. 




## Architecture

Below is a high-level block diagram of the major components in Airbotics:

```
                 + - - - +       + - - - +      + - - - - +     
                 |       |       |       |      |         |  
                 | Bot 1 |       | Bot 2 |      |Dashboard|  
                 |       |       |       |      |         |  
                 + - | - +       + - | - +      + - -|- - +  
                     |               |               |
                     |               |               |
+ - - - - - - - - - -| - - - - - - - | - - - - - - - | - - - - - - - - - +
|                    |               |               |                   |
|                    |               |               |                   |
|    + - - - - - - - | - - - - - - - | - - - - - - - | - - - - - +       |
|    |               v               v               v           |       |
|    |                      API Gateway                          |       |
|    |                                                           |       |
|    + - - | - - - - - - - | - - - - - - - | - - - - - - - | - - +       |
|          |               |               |               |             |
|          |               |               |               |             |
|    + - - | - - +   + - - | - - +   + - - | - - +   + - - | - - +       |
|    |     v     |   |     v     |   |     v     |   |     v     |       |
|    |   Image   |   | Director  |   | Airbotics |   |           |       |
|    |   Repo    |   |   Repo    |   |  Backend  |   |  TreeHub  |       |
|    |           |   |           |   |           |   |           |       |
|    + - - - - - +   + - - - - - +   + - - - - - +   + - - - - - +       |
|                                                                        |
+ - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -  - - - - - +
```


## More In this section

* [Supporting technologies](supporting-technologies.md)

* [Uptane Primer](uptane-primer.md)

* [Core Concepts](core-concepts.md)

* [Features](features.md)

* [FAQ](faq.md)
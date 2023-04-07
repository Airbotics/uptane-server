# Deploying Airbotics

Implenting a solution for over-the-air updates can be an involved process, below are the approximate stages to go from zero to a full-scale deployment of Airbotics on your production fleet. 

Depending on your circumstances this can take anywhere from a few days to 6 months.

At any stage feel free to hop on a [call](https://calendly.com/airbotics/30-min-meeting) with us.

### 1. Registration - sign up to Airbotics
Pretty straightforward - you'll need an account to use Airbotics. You can register one [here](https://dashboard.airbotics.io/registration). While we're in Closed Beta you'll also need an invitation code.

### 2. Consideration - complete the quickstart guide
In this stage an engineer will follow the [quickstart](./quickstart.md) guide to build a basic image using Yocto that includes the meta-updater layer used to communicate with Airbotics. They'll then "flash" this to an emulated robot on their local machine using QEMU. 

The purose of this stage is to gain an understanding of the concepts and workings of Airbotics.


### 3. Development - build a custom image and run it on a real board
We then recommend building a custom image that includes your application, meta-updater and whatever other configuration and utilities your robot's require. This image can then be flashed to the same type of board that's used in your robots. Depending on what board you use, a custom Board Support Package (BSP) may be required.

The purpose of this stage is to understand how to build and flash your image in a way that is compatible with your hardware, Airbotics, OSTree, and other supporting technologies. At this point you may require sign off from management.

In the interest of safety we do not recommend using a real robot at this stage.

### 4. Evaluation - test on internal robots
Once you can successfully build a custom image and flash it to a board we recommend moving to a real robot. To insulate your business and customers, we recommend using internal robot(s) first, e.g. a single robot in your lab, multiple robots on a closed course, an early prototype, a robot dedicated to R&D purposes, etc. 

The purpose of this stage is to evaluate the reliability of Airbotics on your fleet without exposing customers to undue risk. This stage may last from a few days to a few weeks. At this point you may want to invite your teammates, you may also want to develop a custom agent on top of libaktualizr to provide more granular control over when an update is initiated before progressing your production fleet.

### 5. Deployment - roll out out to the full fleet
Once you have confidence Airbotics works for your particular hardware and business requirements you can start rolling it out to your full fleet. Part of this process may require determining a migration strategy to install Airbotics using your current deployment solution. We recommend rolling out Airbotics gradually, e.g. by customer, by area, by model, etc.

At this point you may start to exceed our Free Tier limits and move to our Pro Tier. You may also want to rotate your signing keys offline.

### 6. Celebrate - time to to get back to your robots

Congratulations! 🎉 you've now implemented Airbotics on your full fleet delivering your business bandwidth savings, observability, security and reliability.
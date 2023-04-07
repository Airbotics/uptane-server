# FAQ

### Why use OSTree instead of dual bank updates?
Robotics codebases can get very large and robots are often deployed to areas with poor network connectivity. OSTree uses incremental updates and only pull in changes between versions which minismises network and storage requirements whilst still providing the safety of dual bank updates.

### Can Airbotics work with containers?
It can, you can build containers into your Yocto-based image and run them in whatever way you like (personally we like podman and systemd).

### Why not just use containers?
Robotics development inevitably requires modifications to the OS (e.g. bare-metal processes, devices, networking config, real-time patches, etc.) which containers often don't play well with.

### When should I not consider Airbotics?
- If you're early in the product development lifecycle and have less than 5-10 robots to manage, it may be simpler to use some combination of `ssh`, `rsync`, `git clone`, etc.
- If you don't update your software on a semi-regularly basis.
- If your robots don't have a semi-decent network connection.
- If you're building weaponised robots.

### How does Airbotics make money?
We run a hosted version where we charge a fee per robot per month depending on your fleet size. But we'll always have a free tier and a self-hosted version that don't cost anything.

### Does Airbotics do data collection?
Airbotics is focusing its energy on making shipping software to robots as good as it can be. It’s so important that we believe it deserves its own platform dedicated to it. There are plenty of great existing tools out there for managing how data should be collected from robots.

### Where are my software images stored?
Software images are stored on AWS s3 in the EU.

### Is Airbotics compliant?
Airbotics is currently not complaint but we plan to be SOC 2 Type II complaint at general availability.

### Do I need to manage signing / Uptane keys?
Airbotics manages keys used in Uptane to sign and verify software images.

### Do I have to use Yocto?
Currently, Yocto is the simplest way to build images that work with Airbotics and the only way we support. In theory, tools like [NixOS](https://nixos.org/) or [Packer](https://www.packer.io/) could be used but we don't have official support for them yet.
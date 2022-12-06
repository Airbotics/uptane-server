# FAQ

### Why use OSTree instead of dual bank updates?
Robotics codebases can get very large, OSTree minismises network and storage footprints whilst still providing the safety of dual bank updates.

### Why not just use containers?
Robotics development inevitably requires modifications to the OS (e.g. bare-metal processes, devices, networking config, real-time patches, etc.) which containers often don't play well with.

### When should I not consider Airbotics?

- If you're early in the product development lifecycle and have less than 5-10 robots to manage, it may be simpler to use some combination of `ssh`, `rsync`, `git clone`, etc.
- If you don't update your software semi-regularly.
- If you don't have a semi-decent network connection.

### How does Airbotics make money?

We'll run a hosted version where we'll charge a fee per robot per month depending on fleet size. We'll always have a free tier and a self-hosted version that don't cost anything.
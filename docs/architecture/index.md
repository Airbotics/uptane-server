# Architecture

## Backend
For now, we're building a monolithic backend to perform all functions (Uptane director and image repository, ostree remote repository, etc.). This will likely change to a services/microservices model in time.

### Modules

The backend is split into modules that are each responsible for a subset of the functionality:

**Admin**

Description: Handles actions taken by human adminstrators.

Base URL: `/api/<version>/admin/...`

**Director repo**

Description: Uptane director repository.

Base URL: `/api/<version>/director/...`

More: [documentation](director-repository.md).

**Image repo**

Description: Uptane image repository.

Base URL: `/api/<version>/image/...`

More: [documentation](image-repository.md).

**Treehub**

Description: A remote ostree repository.

Base URL: `/api/<version>/treehub/...`


## Background workers

These workers periodically perform actions in the background without admin intervention.


## The agent

The agent runs on ECUs on robots and handles communication with the backend.

More: [documentation](agent.md).
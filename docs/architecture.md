# Architecture

For now, we're building a monolithic backend to perform all functions (Uptane director and image repository, ostree remote repository, etc.). This will likely change to a services/microservices model in time.

## Modules

The backend is split into modules that are each responsible for a subset of the functionality:

### Admin

Description: Handles actions taken by human adminstrators.

Base URL: `/api/<version>/admin/...`

More: [documentation](modules/admin.md).

### Director repo

Description: Uptane director repository.

Base URL: `/api/<version>/director/...`

More: [documentation](modules/director-repository.md).

### Image repo

Description: Uptane image repository.

Base URL: `/api/<version>/image/...`

More: [documentation](modules/image-repository.md).

### Treehub

Description: A remote ostree repository.

Base URL: `/api/<version>/treehub/...`

More: [documentation](modules/treehub.md).

### Background workers

Description: These workers periodically perform actions in the background without admin intervention.

Base URL: `N/a`

More: [documentation](modules/background-workers.md).
# Architecture

For now, we're building a monolithic backend to perform all functions (Uptane director and image repository, ostree remote repository, etc.). This will likely change to a microservices model in time.

## Modules

### Admin

Description: Handles actions taken by human adminstrators.

Base URL: `/api/<version>/admin/...`

More: [documentation](modules/admin.md).

### Treehub

Description: A remote ostree repository.

Base URL: `/api/<version>/treehub/...`

More: [documentation](modules/treehub.md).

### Image repo

Description: Uptane image repository.

Base URL: `/api/<version>/image/...`

More: [documentation](modules/image-repository.md).
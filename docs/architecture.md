# Architecture

For now, we're building a monolithic backend to perform all functions (Uptane director and image repository, ostree remote repository, etc.). This will likely change to a microservices model in time.

## Modules

### Admin

Description: Actions taken by human adminstrators.

Base URL: `/api/<version>/admin`

### Treehub

Description: A remote ostree repository.

Base URL: `/api/<version>/treehub`

### Image repo

Description: The Uptane image repository.

Base URL: `/api/<version>/image`

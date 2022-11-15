# Architecture

For now, we're building a monolithic backend to perform all functions (Uptane director and image repository, ostree remote repository, etc.). This will likely change to a microservices model in time.

## Modules

### Treehub

A remote ostree repository.
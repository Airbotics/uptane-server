# Architecture

## Backend
For now, we're building a monolithic backend to perform all functions (Uptane director and image repository, ostree remote repository, etc.). This will likely change to a services/microservices model in time.

## Dashboard
The dashboard is web-based GUI to help administer your fleet.

## Background workers

These workers periodically perform actions in the background without user intervention.

## The agent

The agent runs on ECUs on robots and handles communication with the backend. It is built on top of [aktualizr](https://github.com/uptane/aktualizr).
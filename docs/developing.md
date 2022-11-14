# Guide to developing Airbotics

## Including a license notice

This notice should be included at the top of every source code file:

```
/**
 * Copyright 2022 Airbotics, Inc. All Rights Reserved.
 * See LICENSE for license information.
 */
```


## Environment variables

We use the `dotenv` to read environment variables into the app. This reads from a `.env` file at the project's root directory. It should be populated with these variables:

```
PORT        - port the express app listens on
NODE_ENV    - mode to run the server in, 'production' or 'development'
```


## Running the server

From the root directory run the below command.

```
npm run start
```

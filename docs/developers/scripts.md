# Mock Uptane Client
This set of scripts is here to provide a mocked uptane **client** to test against the server implementation in this repo.  

## Server Prerequisites
Before attempting to run the mock client, please ensure the server is running in the development envirnoment and you have performed the following

1. Start the server:
    * `docker-compose up postgres`
    * `npm run start`
2. Generate the necessary key pairs:
    * `npx ts-node src/prisma/seeders/utils/gen-keys.ts`
    * This will create key pairs for the 4 top level TUF roles for the image and director repo as well as pairs for the primary and secondary ECUs that the mocked client will use.
    * This will write the key pairs to `<project-root>/.keys/`
3. Seed the server with some initial data that can be used for testing
    * `npx ts-node src/prisma/seeders/dev/dev-up.ts`


## Client Prerequisites
After the server prerequisites are in place, we can prepare the client.

1. Init the primaries filesystem:
    * `python ops.py init-primary-fs`
    * If this tree already exists, running this again will also clear it out and recreate the directories
2. Copy (out of band) the `root.json` for the **image** and **director** repo to the clients file system.
    * `python ops.py cp-root-meta`

The local file tree should now look like this"

```
├── .keys
|    ├── <team-id>-image-<tuf-role>-public.pem
|    ├── <team-id>-image-<tuf-role>-private.pem
|    ├── <team-id>-director-<tuf-role>-public.pem
|    ├── <team-id>-director-<tuf-role>-private.pem
|    ├── <team-id>-<primary-ecu>-public.pem
|    ├── <team-id>-<primary-ecu>-private.pem
|    ├── <team-id>-<secondary-ecu>-public.pem
|    └── <team-id>-<secondary-ecu>-private.pem
|
└── scripts
    └── mock-uptane
        ├── primary.py
        └── primary-fs
            ├── director
            │   ├── metadata
            |   |   └── root.json
            │   └── targets
            └── image
                ├── metadata
                |   └── root.json
                └── targets
 

```

## Running the client
`python primary.py`


| Action                                  | Description                                                              |
| ----------------------------------------| ------------------------------------------------------------------------ |
| 1. Inspect generated robot manifest     | Print out the generaged robot manifest without sending it to the backend |
| 2. Generate and send robot manifest     | Send the generate robot manifest to the backend                          | 
| 3. Refresh top level metadata           | Refresh the Top level TUF metadata from the image and director repo.     |
| 4. Run update cycle                     | Run the full Uptane update cycle                                         |
| 5. "Install" image on primary ECU       | Change what "installed" image the primary ecu sends with its manifest    |
| 6. "Install" image on secondary ECU     | Change what "installed" image the secondary ecu sends with its manifest  |
| 7. "Report" detected attack on ECU      | Change what "attack" primary ecu sends with its manifest                 |




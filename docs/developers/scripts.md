# Mock Uptane

## Setup Operations
1. Initialise the **director** and **image** repos
    * `python ops.py init-db`
    * This will create the `db` file tree locally
    * This includes dirs for the director, image, and inventory dbs and a dir for keys
    * If this tree already exists, running this again will also clear it out and recreate the directories
2. Generate all the necessary keys
    * `python ops.py gen-keys`
    * It will create and write keys for primay ecu, timeserver, 4 top level role keys for director and image repo
    * Check the db filetree to see the generated keys
3. Start the flask server
    * `python server.py`
4. Generate the initial TUF metadata for the the **director** and **image** repos
    * `python ops.py init-repos`
5. Initialise the vehicle filesystem that the primary client will write to
    * `python ops.py init-primary-fs`
    * This will copy the `root.json` from the primary and director repo to the vehicle filesystem.
6. Initialise the inventory db
    * `python ops.py init-inventory`
    * Note that these mock scripts are only designed to have an inventory of one vehicle

The local file tree should now look like this"

```
├── db
│   ├── director
│   │   ├── metadata
│   │   │   └── <tuf-role>.json
│   │   ├── inventory
│   │   |   └── <VIN>
│   │   └── targets
│   │       └── <target-file>.ext
│   ├── image
│   │   ├── metadata
│   │   │   └── <tuf-role>.json
│   │   └── targets
│   │       └── <target-file>.ext
│   └── keys
|       └── <key-name>.json
|
├── primary-fs
│   ├── director-repo
│   │   ├── metadata
│   │   │   └── root.json
│   │   └── targets
│   └── image-repo
│       ├── metadata
│       │   └── root.json
│       └── targets
|
└── primary.py
```

## Server Operations

### Add a new image
`python ops.py add-image <file-name.ext> <file-content>`

For simplicity in testing, the *images* will be simply be plain text files. You can define the name, extension and content of this file.
* This will write the file to `db/image/targets/<file-name.ext>`
* And also to `db/director/targets/<file-name.ext>`
* This will also create and sign new versions of the `targets`, `snapshot` and `timestamp` metadata files in both the **director** and **image** repos

### Resign timestamp metadata
`python ops.py resign-timestamp`

The `timestamp.json` metadata file will need to be periodically resigned to ensure it has not expired. In production this will be automated but for this mock implementation you will need to do this manually
* This will incremenet the `version` for the `timestamp.json` by 1 in both the **director** and **image** repos

<br/>

## Vehicle Operations

### Register a vehicle with **director**
`python ops.py reg-vehicle`

For simplicity in testing, the *images* will be simply be plain text files. You can define the name, extension and content of this file.
* This will write the file to `db/image/targets/<file-name.ext>`
* And also to `db/director/targets/<file-name.ext>`
* This will also create and sign new versions of the `targets`, `snapshot` and `timestamp` metadata files in both the **director** and **image** repos

### Resign timestamp metadata
`python ops.py add-image <file-name.ext> <file-content>`

The `timestamp.json` metadata file will need to be periodically resigned to ensure it has not expired. In production this will be automated but for this mock implementation you will need to do this manually
* This will incremenet the `version` for the `timestamp.json` by 1 in both the **director** and **image** repos


<br/>

## Running the primary client
`python primary.py`



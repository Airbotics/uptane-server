# Working with s3

We like to use AWS and s3 for storing blobs. We tend to use [localstack](https://localstack.cloud/) for development, this runs a mocked AWS cloud locally. You can swap this out with some other provider.

### Bucket layout

Buckets ids are the same ids used for teams. Within a bucket we two types of objects, images and treehub objects. Their object ids are the object type, followed by a slash, followed by the actual id of the object.

| <- bucket id -> | <- object id ->    |
| --------------- | ------------------ |
| \<team-id>     | /images/\<image-id> |
| \<team-id>     | /images/\<image-id> |


Layout:

```
├── <team-id>
│   ├── images
│   │   └── <image-id>
│   ├── treehub
│   │   └── <object-id>
```


### Useful commands

**List buckets**
```
aws s3 --endpoint-url http://localhost:4566 ls
```

**Create bucket**
```
aws s3 --endpoint-url http://localhost:4566 mb s3://<bucket>
```

**List objects in bucket**
```
aws s3 --endpoint-url http://localhost:4566 ls s3://<bucket>
```

**Force empty and delete bucket**
```
aws s3 --endpoint-url http://localhost:4566 rb s3://<bucket> --force
```

**Copy file from local to remote**
```
echo "test content" >> test.txt
aws s3 --endpoint-url http://localhost:4566 cp test.txt s3://<bucket>/bucket-id
```

**Copy file from remote to local**
```
aws s3 --endpoint-url http://localhost:4566 cp s3://<bucket>/bucket-id new-test.txt
```
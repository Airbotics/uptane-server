import { EBlobStorageProvider } from '@airbotics-core/consts';
import { BlobStorageProvider } from '@airbotics-core/blob-storage';

// Note: this is the same code as aws

// x put a blob that does not already exist
// x put a blob already exists
// x get a blob that exists
// x get a blob that does not exist
// x delete a blob that does not exist
// x delete a blob that exists
// x delete team objects that does not exist
// x delete team objects that exists

const teamId = 'team-id';
const payload = 'test payload';

const objectId = 'objects/prefix/suffix';
// const objectId = 'summary';
// const objectId = 'deltas/prefix/suffix/superblock';


const content = 'content';
const bucketId = 'airbotics-treehub';

const blobStorage = new BlobStorageProvider(EBlobStorageProvider.Filesystem);


test('put a blob that does not already exist', async () => {
    const res = await blobStorage.putObject(bucketId, teamId, objectId, content);
    expect(res).toEqual(true);

    await blobStorage.deleteObject(bucketId, teamId, objectId);

});

test('put a blob already exists', async () => {
    
    await blobStorage.putObject(bucketId, teamId, objectId, content);

    const res = await blobStorage.putObject(bucketId, teamId, objectId, 'content-two');
    expect(res).toEqual(true);

    await blobStorage.deleteObject(bucketId, teamId, objectId);

});


test('get a blob that exists', async () => {
    
    await blobStorage.putObject(bucketId, teamId, objectId, content);

    const data = await blobStorage.getObject(bucketId, teamId, objectId);

    // @ts-ignore
    expect(await data.transformToString()).toEqual(content);

    await blobStorage.deleteObject(bucketId, teamId, objectId);

});


test('get a blob that does not exist', async () => {
    
    try {
        await blobStorage.getObject(bucketId, teamId, objectId);
    } catch (error) {
        expect(error).toBeTruthy();
    }

});


test('delete a blob that does not exist', async () => {
       const res= await blobStorage.deleteObject(bucketId, teamId, objectId);
       expect(res).toEqual(true);
});


test('delete a blob that exists', async () => {
    await blobStorage.putObject(bucketId, teamId, objectId, content);
    const res = await blobStorage.deleteObject(bucketId, teamId, objectId);
    expect(res).toEqual(true);
});




test('delete team objects that does not exist', async () => {
    const res = await blobStorage.deleteTeamObjects(bucketId, teamId);
    expect(res).toEqual(true);
});



test('delete team objects that exists', async () => {

    await blobStorage.putObject(bucketId, teamId, 'objects/prefix/suffix', content);
    await blobStorage.putObject(bucketId, teamId, 'summary', content);
    await blobStorage.putObject(bucketId, teamId, 'deltas/prefix/suffix/superblock', content);

    const res = await blobStorage.deleteTeamObjects(bucketId, teamId);
    expect(res).toEqual(true);
});

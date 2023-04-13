import { EKeyStorageProvider, EKeyType, ESignatureScheme } from '@airbotics-core/consts';
import { generateKeyPair, generateSignature, verifySignature } from '@airbotics-core/crypto';
import { KeyStorageProvider } from '@airbotics-core/key-storage';
import { getKeyStorageRepoKeyId } from '@airbotics-core/utils';
import { TUFRepo, TUFRole } from '@prisma/client';


// Note: could potentially verify key ops with aws cli
// x put a key that does not already exist
// x put a key already exists
// x get a key that exists
// x get a key that does not exist
// x delete a key that does not exist
// x delete a key that exists
// x ensure keys can sign and verify

const teamId = 'team-id';
const payload = 'test payload';
const keyStorage = new KeyStorageProvider(EKeyStorageProvider.AWS);

/*

test('put a key that does not already exist', async () => {
    const keyPair = generateKeyPair({ keyType: EKeyType.Rsa });

    const res = await keyStorage.putKeyPair(getKeyStorageRepoKeyId(teamId, TUFRepo.image, TUFRole.root), keyPair);

    expect(res).toEqual(true);

    await keyStorage.deleteKeyPair(getKeyStorageRepoKeyId(teamId, TUFRepo.image, TUFRole.root));
});


test('put a key already exists', async () => {
    const keyPair = generateKeyPair({ keyType: EKeyType.Rsa });

    await keyStorage.putKeyPair(getKeyStorageRepoKeyId(teamId, TUFRepo.image, TUFRole.root), keyPair);

    try {
        await keyStorage.putKeyPair(getKeyStorageRepoKeyId(teamId, TUFRepo.image, TUFRole.root), keyPair);
    } catch (e) {
        expect(e).toBeTruthy();
    }

    await keyStorage.deleteKeyPair(getKeyStorageRepoKeyId(teamId, TUFRepo.image, TUFRole.root));
});


test('get a key that exists', async () => {
    const keyPair = generateKeyPair({ keyType: EKeyType.Rsa });

    await keyStorage.putKeyPair(getKeyStorageRepoKeyId(teamId, TUFRepo.image, TUFRole.root), keyPair);

    const storedKeyPair = await keyStorage.getKeyPair(getKeyStorageRepoKeyId(teamId, TUFRepo.image, TUFRole.root));

    expect(keyPair.privateKey).toEqual(storedKeyPair.privateKey);
    expect(keyPair.publicKey).toEqual(storedKeyPair.publicKey);

    await keyStorage.deleteKeyPair(getKeyStorageRepoKeyId(teamId, TUFRepo.image, TUFRole.root));
});


test('get a key that does not exist', async () => {
    try {
        await keyStorage.getKeyPair('does-not-exist');
    } catch (e) {
        expect(e).toBeTruthy();
    }
});


test('delete a key that does not exist', async () => {
    try {
        await keyStorage.deleteKeyPair('does-not-exist');
    } catch (e) {
        expect(e).toBeTruthy();
    }
});


test('delete a key that exists', async () => {
    const keyPair = generateKeyPair({ keyType: EKeyType.Rsa });
    await keyStorage.putKeyPair(getKeyStorageRepoKeyId(teamId, TUFRepo.image, TUFRole.root), keyPair);
    const res = await keyStorage.deleteKeyPair(getKeyStorageRepoKeyId(teamId, TUFRepo.image, TUFRole.root));
    expect(res).toEqual(true);
});


test('ensure keys can sign and verify', async () => {
    const keyPair = generateKeyPair({ keyType: EKeyType.Rsa });

    await keyStorage.putKeyPair(getKeyStorageRepoKeyId(teamId, TUFRepo.image, TUFRole.root), keyPair);
    const storedKeyPair = await keyStorage.getKeyPair(getKeyStorageRepoKeyId(teamId, TUFRepo.image, TUFRole.root));

    const signature = generateSignature(payload, storedKeyPair.privateKey, { keyType: EKeyType.Rsa });
    const res = verifySignature(payload, signature, storedKeyPair.publicKey, { signatureScheme: ESignatureScheme.RsassaPssSha256 });

    expect(res).toEqual(true);

    await keyStorage.deleteKeyPair(getKeyStorageRepoKeyId(teamId, TUFRepo.image, TUFRole.root));
});
*/
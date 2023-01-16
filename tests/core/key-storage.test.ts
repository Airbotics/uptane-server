import { EKeyStorageProvider, EKeyType, ESignatureScheme } from '@airbotics-core/consts';
import { generateKeyPair, generateSignature, verifySignature } from '@airbotics-core/crypto';
import { KeyStorageProvider } from '@airbotics-core/key-storage';
import { getKeyStorageRepoKeyId } from '@airbotics-core/utils';
import { TUFRepo, TUFRole } from '@prisma/client';

/**
 * This test creates a key pair, stores it, then reads it back out and is
 * used to create and verify a signature, it is then deleted from storage
 */

test('filesystem - should put and read key', async () => {

    const keyPair = generateKeyPair({ keyType: EKeyType.Rsa });
    const keyStorage = new KeyStorageProvider(EKeyStorageProvider.Filesystem);

    await keyStorage.putKeyPair(getKeyStorageRepoKeyId('teamid', TUFRepo.image, TUFRole.snapshot), keyPair);
    const storedKeyPair = await keyStorage.getKeyPair(getKeyStorageRepoKeyId('teamid', TUFRepo.image, TUFRole.snapshot));

    const payload = 'test payload';
    const signature = generateSignature(payload, storedKeyPair.privateKey, { keyType: EKeyType.Rsa });
    const result = verifySignature(payload, signature, storedKeyPair.publicKey, { signatureScheme: ESignatureScheme.RsassaPssSha256 });

    expect(result).toEqual(true);

    await keyStorage.deleteKeyPair(getKeyStorageRepoKeyId('teamid', TUFRepo.image, TUFRole.snapshot));

});


test('aws - should put and read key', async () => {

    const keyPair = generateKeyPair({ keyType: EKeyType.Rsa });
    const keyStorage = new KeyStorageProvider(EKeyStorageProvider.AWS);

    await keyStorage.putKeyPair(getKeyStorageRepoKeyId('teamid', TUFRepo.image, TUFRole.snapshot), keyPair);
    const storedKeyPair = await keyStorage.getKeyPair(getKeyStorageRepoKeyId('teamid', TUFRepo.image, TUFRole.snapshot));

    const payload = 'test payload';
    const signature = generateSignature(payload, storedKeyPair.privateKey, { keyType: EKeyType.Rsa });
    const result = verifySignature(payload, signature, storedKeyPair.publicKey, { signatureScheme: ESignatureScheme.RsassaPssSha256 });

    expect(result).toEqual(true);

    await keyStorage.deleteKeyPair(getKeyStorageRepoKeyId('teamid', TUFRepo.image, TUFRole.snapshot));

});


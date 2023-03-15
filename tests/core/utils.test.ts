import { getKeyStorageEcuKeyId, getKeyStorageRepoKeyId } from '@airbotics-core/utils';
import { TUFRepo, TUFRole } from '@prisma/client';


test('should return correct key storage key id for a repo', async () => {
    const teamId = 'team-id';
    const repo = TUFRepo.image;
    const role = TUFRole.root;
    const keyId = getKeyStorageRepoKeyId(teamId, repo, role);

    expect(keyId).toEqual(`${teamId}/${repo}/${role}`);
});


test('should return correct key storage key id for an ecu', async () => {
    const teamId = 'team-id';
    const ecuId = 'aa561fa93da44bc5bb2f89402224d711'
    const keyId = getKeyStorageEcuKeyId(teamId, ecuId);

    expect(keyId).toEqual(`${teamId}/${ecuId}`);
});

/*
test('should extract commits from delta id', async () => {
    const prefix = 'M2';
    const suffix = '_TV2F38wdBiLREy1xvUUcgSh81HRez7odWfAzjM_k-NdSxsgJmi+UxquZCbebOp1Qaswjy_Ft6jykJhdo251A';

    const { from, to } = extractCommitsFromDelta(prefix, suffix);

    expect(from).toEqual('336fd3576177f3074188b444cb5c6f5147204a1f351d17b3ee87567c0ce333f9.commit');
    expect(to).toEqual('35d4b1b202668be531aae6426de6cea7541ab308f2fc5b7a8f290985da36e750.commit');
});


test('should extract commits from delta id', async () => {
    const prefix = 'Gp';
    const suffix = 'TyZaVut2jXFPWnO4LJiKEdRTvOw_mFUCtIKW1NIX0-L8f+VVDkEBKNc1Ncd+mDUrSVR4EyybQGCkuKtkDnTwk';

    const { from, to } = extractCommitsFromDelta(prefix, suffix);

    expect(from).toEqual('1a94f265a56eb768d714f5a73b82c988a11d453bcec3f985502b48296d4d217d.commit');
    expect(to).toEqual('2fc7fe5550e410128d73535c77e98352b495478132c9b4060a4b8ab640e74f09.commit');
});
*/
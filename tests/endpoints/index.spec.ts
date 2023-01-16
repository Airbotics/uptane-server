import request from 'supertest';
import app from '../../src/app';


/**
 * This file simply checks all endpoints exist and do not return a 404
 */



/**
 * Misc
 */
test('health check', async () => {
    const res = await request(app).get('/');
    expect(res.status).not.toEqual(404);
});


/**
 * Treehub
 */
test('treehub - get config', async () => {
    const res = await request(app).get('/api/v0/robot/treehub/config');
    expect(res.status).not.toEqual(404);
});

test('treehub - upload summary', async () => {
    const res = await request(app).put('/api/v0/robot/treehub/b5491bbe-1c90-4567-bbc5-724327759d12/summary');
    expect(res.status).not.toEqual(404);
});

test('treehub - get summary', async () => {
    const res = await request(app).get('/api/v0/robot/treehub/summary');
    expect(res.status).not.toEqual(404);
});

test('treehub - get summary', async () => {
    const res = await request(app).get('/api/v0/robot/treehub/summary.sig');
    expect(res.status).not.toEqual(404);
});

test('treehub - upload ref', async () => {
    const res = await request(app).post('/api/v0/robot/treehub/b5491bbe-1c90-4567-bbc5-724327759d12/refs/heads/main');
    expect(res.status).not.toEqual(404);
});


test('treehub - get ref', async () => {
    const res = await request(app).get('/api/v0/robot/treehub/b5491bbe-1c90-4567-bbc5-724327759d12/refs/heads/main');
    expect(res.status).not.toEqual(404);
});

test('treehub - get ref', async () => {
    const res = await request(app).get('/api/v0/robot/treehub/refs/heads/main');
    expect(res.status).not.toEqual(404);
});

test('treehub - upload object', async () => {
    const res = await request(app).post('/api/v0/robot/treehub/b5491bbe-1c90-4567-bbc5-724327759d12/objects/00/4aa65ad9ef18905c36c69143bcca7e72de424889d3a001669db7cf23324599.filez');
    expect(res.status).not.toEqual(404);
});

// Note: this is suppose to return 404 if the object does not exist
test('treehub - check object', async () => {
    const res = await request(app).head('/api/v0/robot/treehub/b5491bbe-1c90-4567-bbc5-724327759d12/objects/00/4aa65ad9ef18905c36c69143bcca7e72de424889d3a001669db7cf23324599.filez');
    expect(res.status).toEqual(404);
});

// Note: this is suppose to return 404 if the object does not exist
test('treehub - get object', async () => {
    const res = await request(app).get('/api/v0/robot/treehub/b5491bbe-1c90-4567-bbc5-724327759d12/objects/00/4aa65ad9ef18905c36c69143bcca7e72de424889d3a001669db7cf23324599.filez');
    expect(res.status).toEqual(404);
});

test('treehub - get object robot', async () => {
    const res = await request(app).get('/api/v0/robot/treehub/objects/00/4aa65ad9ef18905c36c69143bcca7e72de424889d3a001669db7cf23324599.filez');
    expect(res.status).not.toEqual(404);
});

test('treehub - generate delta', async () => {
    const res = await request(app).post('/api/v0/robot/treehub/b5491bbe-1c90-4567-bbc5-724327759d12/deltas');
    expect(res.status).not.toEqual(404);
});


/**
 * Admin
 */
test('admin - account - update account', async () => {
    const res = await request(app).put('/api/v0/admin/account');
    expect(res.status).not.toEqual(404);
});

test('admin - images - list images', async () => {
    const res = await request(app).get('/api/v0/admin/images');
    expect(res.status).not.toEqual(404);
});

test('admin - provisioning credentials - create provisioning credential', async () => {
    const res = await request(app).post('/api/v0/admin/provisioning-credentials');
    expect(res.status).not.toEqual(404);
});

test('admin - provisioning credentials - list provisioning credentials', async () => {
    const res = await request(app).get('/api/v0/admin/provisioning-credentials');
    expect(res.status).not.toEqual(404);
});

test('admin - robots - list robots', async () => {
    const res = await request(app).get('/api/v0/admin/robots');
    expect(res.status).not.toEqual(404);
});

test('admin - robots - get robot details', async () => {
    const res = await request(app).get('/api/v0/admin/robots/123e4567-e89b-12d3-a456-426614174000');
    expect(res.status).not.toEqual(404);
});

test('admin - robots - delete', async () => {
    const res = await request(app).delete('/api/v0/admin/robots/123e4567-e89b-12d3-a456-426614174000');
    expect(res.status).not.toEqual(404);
});

test('admin - rollouts - create rollout', async () => {
    const res = await request(app).post('/api/v0/admin/rollouts');
    expect(res.status).not.toEqual(404);
});

test('admin - rollouts - get rollout detail', async () => {
    const res = await request(app).get('/api/v0/admin/rollouts/123e4567-e89b-12d3-a456-426614174000');
    expect(res.status).not.toEqual(404);
});

test('admin - rollouts - list rollouts', async () => {
    const res = await request(app).get('/api/v0/admin/rollouts');
    expect(res.status).not.toEqual(404);
});

test('admin - teams - create team', async () => {
    const res = await request(app).post('/api/v0/admin/teams');
    expect(res.status).not.toEqual(404);
});

test('admin - teams - list teams', async () => {
    const res = await request(app).get('/api/v0/admin/teams');
    expect(res.status).not.toEqual(404);
});

test('admin - teams - update team', async () => {
    const res = await request(app).patch('/api/v0/admin/teams');
    expect(res.status).not.toEqual(404);
});

test('admin - teams - list team members', async () => {
    const res = await request(app).get('/api/v0/admin/teams/members');
    expect(res.status).not.toEqual(404);
});

test('admin - teams - delete team', async () => {
    const res = await request(app).delete('/api/v0/admin/teams');
    expect(res.status).not.toEqual(404);
});

/**
 * Groups
 */

test('admin - groups - list groups a robot is in', async () => {
    const res = await request(app).get('/api/v0/admin/robots/123e4567-e89b-12d3-a456-426614174000/groups');
    expect(res.status).not.toEqual(404);
});

test('admin - groups - create a group', async () => {
    const res = await request(app).post('/api/v0/admin/groups');
    expect(res.status).not.toEqual(404);
});


test('admin - groups - lists group', async () => {
    const res = await request(app).get('/api/v0/admin/groups');
    expect(res.status).not.toEqual(404);
});


test('admin - groups - get group detail', async () => {
    const res = await request(app).get('/api/v0/admin/groups/123e4567-e89b-12d3-a456-426614174000');
    expect(res.status).not.toEqual(404);
});


test('admin - groups - update group', async () => {
    const res = await request(app).patch('/api/v0/admin/groups/123e4567-e89b-12d3-a456-426614174000');
    expect(res.status).not.toEqual(404);
});

test('admin - groups - delete group', async () => {
    const res = await request(app).delete('/api/v0/admin/groups/123e4567-e89b-12d3-a456-426614174000');
    expect(res.status).not.toEqual(404);
});

test('admin - groups - get robots in a group', async () => {
    const res = await request(app).get('/api/v0/admin/groups/123e4567-e89b-12d3-a456-426614174000/robots');
    expect(res.status).not.toEqual(404);
});

test('admin - groups - add robot to group', async () => {
    const res = await request(app).post('/api/v0/admin/groups/123e4567-e89b-12d3-a456-426614174000/robots');
    expect(res.status).not.toEqual(404);
});

test('admin - groups - remove robot from group', async () => {
    const res = await request(app).delete('/api/v0/admin/groups/123e4567-e89b-12d3-a456-426614174000/robots');
    expect(res.status).not.toEqual(404);
});



/**
 * Director repo
 */
test('director repo - upload manifest', async () => {
    const res = await request(app).put('/api/v0/robot/director/manifest');
    expect(res.status).not.toEqual(404);
});

test('director repo - register ecu', async () => {
    const res = await request(app).post('/api/v0/robot/director/ecus');
    expect(res.status).not.toEqual(404);
});

test('director repo - get version of a role', async () => {
    const res = await request(app).get('/api/v0/robot/director/1.root.json');
    expect(res.status).not.toEqual(404);
});

test('director repo - get latest role', async () => {
    const res = await request(app).get('/api/v0/robot/director/root.json');
    expect(res.status).not.toEqual(404);
});


/**
 * Image repo
 */
test('image repo - get version of a role', async () => {
    const res = await request(app).get('/api/v0/robot/repo/1.root.json');
    expect(res.status).not.toEqual(404);
});

test('image repo - get latest role', async () => {
    const res = await request(app).get('/api/v0/robot/repo/root.json');
    expect(res.status).not.toEqual(404);
});

test('image repo - upload targets', async () => {
    const res = await request(app).put('/api/v0/robot/repo/b5491bbe-1c90-4567-bbc5-724327759d12/api/v1/user_repo/targets');
    expect(res.status).not.toEqual(404);
});

test('image repo - fetch targets', async () => {
    const res = await request(app).get('/api/v0/robot/repo/b5491bbe-1c90-4567-bbc5-724327759d12/api/v1/user_repo/targets.json');
    expect(res.status).not.toEqual(404);
});


/**
 * Robot
 */
test('robots - register robot', async () => {
    const res = await request(app).post('/api/v0/robot/devices');
    expect(res.status).not.toEqual(404);
});

test('robots - register robot', async () => {
    const res = await request(app).post('/api/v0/robot/devices');
    expect(res.status).not.toEqual(404);
});

test('robots - register robot', async () => {
    const res = await request(app).post('/api/v0/robot/devices');
    expect(res.status).not.toEqual(404);
});

test('robots - put system info', async () => {
    const res = await request(app).put('/api/v0/robot/system_info');
    expect(res.status).not.toEqual(404);
});

test('robots - put config', async () => {
    const res = await request(app).post('/api/v0/robot/system_info/config');
    expect(res.status).not.toEqual(404);
});

test('robots - put installed packages', async () => {
    const res = await request(app).put('/api/v0/robot/core/installed');
    expect(res.status).not.toEqual(404);
});

test('robots - put event', async () => {
    const res = await request(app).post('/api/v0/robot/events');
    expect(res.status).not.toEqual(404);
});

test('robots - put network info', async () => {
    const res = await request(app).put('/api/v0/system_info/network');
    expect(res.status).not.toEqual(404);
});
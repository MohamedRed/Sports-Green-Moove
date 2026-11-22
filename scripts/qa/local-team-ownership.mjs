import assert from 'node:assert/strict';
import { db, document, signIn } from './local-flow-client.mjs';
import { configureLocalEmulators } from './local-emulator-config.mjs';

export async function checkTeamOwnership() {
  const { projectId } = configureLocalEmulators();
  const manager = await signIn('c@example.test');
  const ownClubId = 'sgm-qa-club-green-wavre';
  const foreignClub = db.collection('clubs').doc(), foreignTeam = db.collection('teams').doc(), ownTeam = db.collection('teams').doc();
  await foreignClub.create({ name: 'Autre club équipe QA', status: 'public' });
  const original = { clubId: foreignClub.id, name: 'Équipe étrangère QA', category: 'U8', status: 'active' };
  await foreignTeam.create(original);
  await ownTeam.create({ ...original, clubId: ownClubId, name: 'Équipe locale QA' });
  const origin = `http://${process.env.FIRESTORE_EMULATOR_HOST}/v1/projects/${projectId}/databases/(default)/documents`;
  const resource = `projects/${projectId}/databases/(default)/documents/teams/${foreignTeam.id}`;
  async function write(actor, method, fields, mask) {
    const url = new URL(`${origin}/teams/${foreignTeam.id}`);
    if (mask) for (const field of mask) url.searchParams.append('updateMask.fieldPaths', field);
    const commit = method === 'commit';
    const response = await fetch(commit ? origin + ':commit' : url, { method: commit ? 'POST' : method,
      redirect: 'error', signal: AbortSignal.timeout(10_000), headers: { 'content-type': 'application/json',
        ...(actor ? { authorization: `Bearer ${actor.token}` } : {}) }, body: method === 'DELETE' ? undefined : JSON.stringify(commit
        ? { writes: [{ update: { name: resource, fields }, updateMask: { fieldPaths: mask } }] } : { fields }) });
    return { status: response.status, body: await response.json() };
  }
  const attempts = [];
  async function denied(actor, method, fields, mask, kind) {
    const response = await write(actor, method, fields, mask);
    assert.equal(response.status, 403, `${kind} must be denied`);
    assert.equal(response.body.error?.status, 'PERMISSION_DENIED');
    assert.deepEqual(await document('teams', foreignTeam.id), original, 'Denied writes must preserve all team fields');
    attempts.push({ kind, status: response.status, unchanged: true });
  }
  const changed = { clubId: { stringValue: ownClubId }, name: { stringValue: 'Doit rester inchangé QA' } };
  await denied(manager, 'PATCH', changed, ['clubId', 'name'], 'foreign-club-patch-takeover');
  await denied(manager, 'PATCH', { ...changed, category: { stringValue: 'U8' }, status: { stringValue: 'active' } },
    undefined, 'foreign-club-document-replacement');
  await denied(manager, 'commit', changed, ['clubId', 'name'], 'foreign-club-atomic-commit-takeover');
  await denied(manager, 'PATCH', { name: { stringValue: 'Denied' } }, ['name'], 'foreign-club-name-edit');
  await denied(manager, 'DELETE', {}, undefined, 'foreign-club-delete');
  for (const actor of [await signIn('p@example.test'), await signIn('outsider@example.test'), null])
    await denied(actor, 'PATCH', changed, ['clubId', 'name'], actor ? 'non-manager-takeover' : 'signed-out-takeover');

  const secondMembership = db.collection('memberships').doc(`${manager.uid}_${foreignClub.id}`);
  await secondMembership.create({ userId: manager.uid, clubId: foreignClub.id, role: 'clubManager', status: 'active', active: true });
  await denied(manager, 'PATCH', changed, ['clubId', 'name'], 'two-club-manager-reassignment');
  await secondMembership.update({ active: false });
  await denied(manager, 'PATCH', { name: { stringValue: 'Denied' } }, ['name'], 'disabled-manager-edit');

  const ownUrl = `${origin}/teams/${ownTeam.id}?updateMask.fieldPaths=name`;
  const title = 'Équipe renommée QA';
  const updated = await fetch(ownUrl, { method: 'PATCH', redirect: 'error', signal: AbortSignal.timeout(10_000),
    headers: { 'content-type': 'application/json', authorization: `Bearer ${manager.token}` },
    body: JSON.stringify({ fields: { name: { stringValue: title } } }) });
  assert.equal(updated.status, 200);
  assert.deepEqual(await document('teams', ownTeam.id), { ...original, clubId: ownClubId, name: title });
  assert.deepEqual(await document('teams', foreignTeam.id), original);
  return { method: 'authenticated-local-firestore-rest-with-independent-persisted-checks',
    sourceTeamId: foreignTeam.id, sourceClubId: foreignClub.id, managerClubId: ownClubId,
    deniedMutations: attempts.length, attempts, foreignTeamUnchanged: true, scopedNameEditAllowed: true,
    twoClubReassignmentDenied: true, disabledManagerDenied: true, nativeUi: false, productionDeployed: false,
    limits: ['Team ownership boundary only; no team assignment, guardian enrollment or team conversation is implemented or verified.'] };
}

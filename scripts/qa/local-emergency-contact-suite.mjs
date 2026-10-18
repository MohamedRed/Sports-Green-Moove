import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { Timestamp } from 'firebase-admin/firestore';
import { auth, call, db, denied, signIn } from './local-flow-client.mjs';
import { emergencyContactId } from '../../functions/lib/domain/emergencyContact.js';
import { fetchLocalQa } from './local-http-request.mjs';

execFileSync(process.execPath, [resolve(import.meta.dirname, 'seed-firebase-emulator.mjs')],
  { env: process.env, stdio: ['ignore', 'pipe', 'pipe'], timeout: 90_000 });
const parent = await signIn('p@example.test'), manager = await signIn('c@example.test'), driver = await signIn('d@example.test');
async function actor(uid, roles) {
  const email = `${uid}@example.test`;
  await auth.createUser({ uid, email, password: process.env.SGM_QA_PASSWORD });
  await auth.setCustomUserClaims(uid, { roleKeys: roles }); return signIn(email);
}
const other = await actor('emergency-other-parent', ['parent']), admin = await actor('emergency-admin', ['admin']);
const child = await actor('emergency-child', ['child', 'parent']);
const clubId = 'sgm-qa-club-green-wavre', childId = 'sgm-qa-child-lina';
const self = { kind: 'self' }, target = { kind: 'child', childId, clubId };
const contact = { name: 'Contact fictif QA', phone: '+12025550123' };
const changed = { name: 'Second contact fictif QA', phone: '+12025550124' };
const read = (actor = parent, scope = self) => call('getEmergencyContact', actor, { target: scope });
const input = (scope, revision, value = contact) => ({ target: scope, expectedRevision: revision, contact: value, requestId: randomUUID() });
const save = (actor, data) => call('saveEmergencyContact', actor, data);
const transition = (actor, action, revision) => call('transitionGuardianVerification', actor,
  { clubId, childId, parentUserId: parent.uid, action, expectedRevision: revision, requestId: randomUUID() });
const contactRef = db.collection('emergencyContacts').doc(emergencyContactId('child', childId));
const selfRef = db.collection('emergencyContacts').doc(emergencyContactId('self', parent.uid));
const checks = [], check = async (id, action) => { await action(); checks.push({ id, status: 'passed' }); };
await check('signed-out-child-and-admin-only-accounts-cannot-manage-contacts', async () => {
  for (const actor of [null, child, admin]) {
    const code = actor ? 'PERMISSION_DENIED' : 'UNAUTHENTICATED';
    await denied('getEmergencyContact', actor, { target: self }, code);
    await denied('saveEmergencyContact', actor, input(self, 0), code);
  }
});
await check('self-ownership-is-auth-bound-with-no-client-selected-user-id', async () => {
  assert.deepEqual(await read(), { kind: 'self', subjectId: parent.uid, contact: null, revision: 0 });
  await denied('getEmergencyContact', other, { target: { ...self, userId: parent.uid } }, 'INVALID_ARGUMENT');
  await denied('saveEmergencyContact', other, { ...input(self, 0), ownerUserId: parent.uid }, 'INVALID_ARGUMENT');
  assert.equal((await selfRef.get()).exists, false);
});
await check('international-phone-name-uuid-and-safe-revision-validation-are-strict', async () => {
  for (const value of [{ ...contact, phone: '0470000000' }, { ...contact, phone: '112' }, { ...contact, phone: '+0123456789' },
    { ...contact, phone: '+12025550123;123' }, { ...contact, name: ' ' }, { ...contact, name: 'Name\nPrivate' }, { ...contact, extra: true }])
    await denied('saveEmergencyContact', parent, input(self, 0, value), 'INVALID_ARGUMENT');
  for (const patch of [{ requestId: 'bad' }, { expectedRevision: -1 }, { expectedRevision: 0.5 }, { expectedRevision: Number.MAX_SAFE_INTEGER }])
    await denied('saveEmergencyContact', parent, { ...input(self, 0), ...patch }, 'INVALID_ARGUMENT');
});
let first;
await check('adult-save-reload-and-another-account-have-distinct-private-contacts', async () => {
  first = input(self, 0); assert.equal((await save(parent, first)).revision, 1);
  assert.deepEqual(await read(), { kind: 'self', subjectId: parent.uid, contact, revision: 1 });
  assert.equal((await read(other)).contact, null); await save(other, input(self, 0, changed));
  assert.deepEqual((await read()).contact, contact);
  for (const actor of [driver, manager]) { await save(actor, input(self, 0)); assert.deepEqual((await read(actor)).contact, contact); }
});
await check('same-operation-replay-does-not-write-and-changed-payload-cannot-reuse-identity', async () => {
  const before = (await selfRef.get()).data();
  assert.equal((await save(parent, first)).replayed, true); assert.deepEqual((await selfRef.get()).data(), before);
  await denied('saveEmergencyContact', parent, { ...first, contact: changed }, 'ALREADY_EXISTS');
});
await check('concurrent-edits-have-one-winner-and-cannot-overwrite-the-new-revision', async () => {
  const edits = [input(self, 1, changed), input(self, 1, { ...changed, name: 'Autre choix fictif QA' })];
  const outcomes = await Promise.allSettled(edits.map((data) => save(parent, data)));
  assert.equal(outcomes.filter((item) => item.status === 'fulfilled').length, 1);
  assert.equal(outcomes.find((item) => item.status === 'rejected').reason.code, 'FAILED_PRECONDITION');
  assert.equal((await read()).revision, 2);
});
await check('removal-keeps-a-tombstone-and-old-create-or-replay-cannot-restore-a-number', async () => {
  await save(parent, input(self, 2, null)); const removed = await read();
  assert.equal(removed.contact, null); assert.equal(removed.revision, 3);
  assert.equal((await save(parent, first)).revision, 3); assert.equal((await read()).contact, null);
  await denied('saveEmergencyContact', parent, input(self, 0), 'FAILED_PRECONDITION');
  await save(parent, input(self, 3)); assert.equal((await read()).revision, 4);
});
await check('declared-and-pending-parent-links-never-authorize-child-contact-access', async () => {
  await denied('getEmergencyContact', parent, { target }, 'PERMISSION_DENIED');
  await denied('saveEmergencyContact', parent, input(target, 0), 'PERMISSION_DENIED');
  await transition(parent, 'request', 0);
  await denied('saveEmergencyContact', parent, input(target, 0), 'PERMISSION_DENIED');
  await transition(manager, 'refuse', 1);
  await denied('getEmergencyContact', parent, { target }, 'PERMISSION_DENIED');
  assert.equal((await contactRef.get()).exists, false);
});
let childWrite;
await check('manager-verification-enables-parent-save-but-not-manager-or-other-parent-access', async () => {
  await transition(parent, 'request', 2); await transition(manager, 'verify', 3);
  childWrite = input(target, 0); await save(parent, childWrite);
  assert.deepEqual((await read(parent, target)).contact, contact);
  for (const actor of [manager, other, driver, admin, child]) {
    await denied('getEmergencyContact', actor, { target }, 'PERMISSION_DENIED');
    await denied('saveEmergencyContact', actor, input(target, 1, changed), 'PERMISSION_DENIED');
  }
});
await check('revocation-blocks-read-edit-removal-and-even-an-already-committed-replay', async () => {
  await transition(manager, 'revoke', 4); const before = (await contactRef.get()).data();
  await denied('getEmergencyContact', parent, { target }, 'PERMISSION_DENIED');
  for (const data of [input(target, 1, changed), input(target, 1, null), childWrite])
    await denied('saveEmergencyContact', parent, data, 'PERMISSION_DENIED');
  assert.deepEqual((await contactRef.get()).data(), before);
  await transition(parent, 'request', 5); await transition(manager, 'verify', 6);
});
await check('removed-child-link-inactive-membership-and-archived-club-revoke-contact-access', async () => {
  for (const [ref, patch] of [[db.collection('children').doc(childId), { guardianUserIds: [] }],
    [db.collection('memberships').doc(`${parent.uid}_${clubId}`), { active: false }],
    [db.collection('clubs').doc(clubId), { status: 'archived' }]]) {
    const before = (await ref.get()).data(); await ref.update(patch);
    await denied('getEmergencyContact', parent, { target }, 'PERMISSION_DENIED');
    await denied('saveEmergencyContact', parent, input(target, 1, changed), 'PERMISSION_DENIED');
    await ref.set(before);
  }
});
await check('child-contact-and-authority-tuple-cannot-be-swapped-or-overridden', async () => {
  for (const scope of [{ ...target, clubId: 'foreign-club' }, { ...target, childId: 'foreign-child' }]) {
    await denied('getEmergencyContact', parent, { target: scope }, 'PERMISSION_DENIED');
    await denied('saveEmergencyContact', parent, input(scope, 0), 'PERMISSION_DENIED');
  }
  await denied('getEmergencyContact', parent, { target: { ...target, parentUserId: manager.uid } }, 'INVALID_ARGUMENT');
});
await check('concurrent-revocation-fences-all-future-writes-without-restoring-authority', async () => {
  const results = await Promise.allSettled([save(parent, input(target, 1, changed)), transition(manager, 'revoke', 7)]);
  assert.equal(results[1].status, 'fulfilled');
  if (results[0].status === 'rejected') assert.equal(results[0].reason.code, 'PERMISSION_DENIED');
  const before = (await contactRef.get()).data(); assert([1, 2].includes(before.revision));
  await denied('saveEmergencyContact', parent, input(target, before.revision), 'PERMISSION_DENIED');
  assert.deepEqual((await contactRef.get()).data(), before);
});
await check('direct-client-reads-queries-and-writes-are-denied-even-for-manager-and-admin', async () => {
  const host = process.env.FIRESTORE_EMULATOR_HOST;
  assert(/^127\.0\.0\.1:\d+$/.test(host));
  const base = `http://${host}/v1/projects/demo-sgm-local-qa/databases/(default)/documents`;
  const original = (await selfRef.get()).data();
  for (const actor of [null, parent, other, manager, admin]) for (const collection of ['emergencyContacts', 'emergencyContactOperations']) {
    const headers = actor ? { authorization: `Bearer ${actor.token}` } : {};
    for (const [path, method] of [[collection, 'GET'], [`${collection}/${selfRef.id}`, 'GET'], [`${collection}/${selfRef.id}`, 'DELETE'],
      [`${collection}/${selfRef.id}`, 'PATCH']]) {
      const response = await fetchLocalQa(`${base}/${path}`, { method, headers: { ...headers, 'content-type': 'application/json' },
        ...(method === 'PATCH' ? { body: JSON.stringify({ fields: { forged: { booleanValue: true } } }) } : {}) });
      assert.equal(response.status, 403, 'Direct client access must be denied'); await response.arrayBuffer();
    }
  }
  assert.deepEqual((await selfRef.get()).data(), original);
});
await check('malformed-stored-records-fail-closed-rather-than-looking-like-missing-contacts', async () => {
  const previous = (await selfRef.get()).data();
  for (const patch of [{ revision: 0 }, { subjectId: other.uid }, { contact: { name: 'Bad', phone: '112' } }, { unknown: true }]) {
    await selfRef.set({ ...previous, ...patch });
    await denied('getEmergencyContact', parent, { target: self }, 'FAILED_PRECONDITION');
    await denied('saveEmergencyContact', parent, input(self, 4), 'FAILED_PRECONDITION');
  }
  await selfRef.set(previous);
});
await check('contact-details-stay-out-of-operations-and-public-club-team-and-child-documents', async () => {
  for (const collection of ['emergencyContactOperations', 'clubs', 'teams', 'children', 'guardianVerificationEvents']) {
    const values = JSON.stringify((await db.collection(collection).get()).docs.map((doc) => doc.data()));
    for (const value of [contact.name, contact.phone, changed.name, changed.phone]) assert(!values.includes(value));
  }
});
const sources = ['functions/src/domain/emergencyContact.ts', 'functions/src/services/emergencyContactAuthority.ts',
  'functions/src/services/emergencyContact.ts', 'functions/src/callables/emergencyContact.ts', 'firestore.rules'];
const result = { projectId: 'demo-sgm-local-qa', runId: process.env.SGM_LOCAL_RUN_ID, testedAt: new Date().toISOString(),
  scope: 'local-emulated-contact-services-not-native-handoff', testCount: checks.length, checks,
  providerRequests: 0, productionWrites: false, nativeUiExecuted: false, physicalDevice: false, dialerOpened: false,
  sourceFiles: Object.fromEntries(sources.map((path) => [path, createHash('sha256')
    .update(readFileSync(resolve(import.meta.dirname, '../..', path))).digest('hex')])) };
mkdirSync(dirname(process.env.SGM_LOCAL_FLOW_OUTPUT), { recursive: true });
writeFileSync(process.env.SGM_LOCAL_FLOW_OUTPUT, JSON.stringify(result, null, 2) + '\n');
console.log(`Passed ${checks.length} isolated emergency-contact service groups; no phone handoff tested.`);

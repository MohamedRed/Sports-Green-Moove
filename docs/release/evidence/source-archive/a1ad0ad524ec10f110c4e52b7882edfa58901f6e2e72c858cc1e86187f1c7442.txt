import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { auth, call, db, denied, signIn } from './local-flow-client.mjs';
import { emergencyChildInstanceId, emergencyContactId, legacyChildEmergencyContactId } from '../../functions/lib/domain/emergencyContact.js';
import { guardianVerificationId } from '../../functions/lib/domain/guardianVerification.js';

execFileSync(process.execPath, [resolve(import.meta.dirname, 'seed-firebase-emulator.mjs')],
  { env: process.env, stdio: ['ignore', 'pipe', 'pipe'], timeout: 90_000 });
const parent = await signIn('p@example.test'), manager = await signIn('c@example.test');
const clubId = 'sgm-qa-club-green-wavre', childId = 'sgm-qa-child-lina', target = { kind: 'child', childId, clubId };
const contact = { name: 'Contact fictif QA', phone: '+12025550123' }, changed = { name: 'Autre contact fictif QA', phone: '+12025550124' };
const roles = (await auth.getUser(parent.uid)).customClaims, checks = [];
const check = async (id, action) => { await action(); checks.push({ id, status: 'passed' }); };
const read = (scope = target) => call('getEmergencyContact', parent, { target: scope });
const input = (view, value = contact, requestId = randomUUID()) => ({ target: { kind: 'child', childId: view.subjectId, clubId: view.clubId },
  expectedChildInstanceId: view.childInstanceId, expectedRevision: view.revision, contact: value, requestId });
async function verify(scope = target) {
  const ref = db.collection('guardianVerifications').doc(guardianVerificationId(scope.clubId, scope.childId, parent.uid));
  const transition = async (actor, action) => call('transitionGuardianVerification', actor,
    { clubId: scope.clubId, childId: scope.childId, parentUserId: parent.uid, action,
      expectedRevision: (await ref.get()).get('revision') ?? 0, requestId: randomUUID() });
  if ((await ref.get()).get('status') === 'verified') await transition(manager, 'revoke');
  if ((await ref.get()).get('status') !== 'requested') await transition(parent, 'request');
  await transition(manager, 'verify');
}
async function recreate(id, collection = 'children') {
  const ref = db.collection(collection).doc(id), before = await ref.get();
  await ref.delete(); await ref.create(before.data());
  const after = await ref.get(); assert(!before.createTime.isEqual(after.createTime)); return after;
}
const refFor = (view) => db.collection('emergencyContacts').doc(emergencyContactId('child', view.subjectId, view.childInstanceId));
let original, firstWrite, savedOriginal, fresh;
await check('real-two-actor-verification-returns-one-transaction-bound-child-identity-and-labels', async () => {
  await verify(); original = await read(); assert.match(original.childInstanceId, /^[a-f0-9]{64}$/);
  assert.equal(original.childInstanceId, emergencyChildInstanceId(childId, (await db.collection('children').doc(childId).get()).createTime));
  assert.equal(original.clubId, clubId); assert(original.childName && original.clubName);
  firstWrite = input(original); await call('saveEmergencyContact', parent, firstWrite);
  savedOriginal = (await refFor(original).get()).data(); assert.equal(savedOriginal.childInstanceId, original.childInstanceId);
});
await check('recreated-child-denies-obsolete-verification-read-edit-removal-and-committed-replay', async () => {
  await recreate(childId);
  await denied('getEmergencyContact', parent, { target }, 'PERMISSION_DENIED');
  for (const data of [firstWrite, { ...firstWrite, requestId: randomUUID(), expectedRevision: 1, contact: changed },
    { ...firstWrite, requestId: randomUUID(), expectedRevision: 1, contact: null }])
    await denied('saveEmergencyContact', parent, data, 'PERMISSION_DENIED');
  assert.deepEqual((await refFor(original).get()).data(), savedOriginal);
});
await check('fresh-manager-verification-does-not-inherit-the-previous-childs-contact-or-version', async () => {
  await verify(); fresh = await read(); assert.notEqual(fresh.childInstanceId, original.childInstanceId);
  assert.equal(fresh.contact, null); assert.equal(fresh.revision, 0);
  assert.deepEqual((await refFor(original).get()).data(), savedOriginal);
});
await check('old-view-and-operation-identities-cannot-target-the-new-child-even-at-revision-zero', async () => {
  for (const data of [firstWrite, { ...firstWrite, requestId: randomUUID() }])
    await denied('saveEmergencyContact', parent, data, 'FAILED_PRECONDITION');
  await denied('saveEmergencyContact', parent, input(fresh, changed, firstWrite.requestId), 'ALREADY_EXISTS');
  assert(!(await refFor(fresh).get()).exists);
});
await check('only-a-fresh-view-can-save-the-new-child-without-changing-the-original-record', async () => {
  const receipt = await call('saveEmergencyContact', parent, input(fresh, changed));
  assert.equal(receipt.childInstanceId, fresh.childInstanceId); assert.equal(receipt.clubId, clubId);
  assert.deepEqual((await read()).contact, changed); assert.equal((await read()).revision, 1);
  assert.deepEqual((await refFor(original).get()).data(), savedOriginal);
});
await check('a-never-saved-old-child-form-cannot-create-a-contact-for-a-recreated-profile', async () => {
  const id = 'sgm-qa-emergency-empty-identity', scope = { ...target, childId: id };
  await db.collection('children').doc(id).create({ displayName: 'Autre enfant fictif QA', guardianUserIds: [parent.uid] });
  await verify(scope); const empty = await read(scope), stale = input(empty);
  await recreate(id); await verify(scope); const latest = await read(scope);
  assert.equal(latest.revision, 0); assert.equal(latest.contact, null); assert.notEqual(latest.childInstanceId, empty.childInstanceId);
  await denied('saveEmergencyContact', parent, stale, 'FAILED_PRECONDITION');
  assert(!(await refFor(empty).get()).exists); await call('saveEmergencyContact', parent, input(latest));
  assert.equal((await read(scope)).revision, 1);
});
await check('a-recreated-club-requires-a-fresh-decision-without-changing-the-child-contact-identity', async () => {
  await recreate(clubId, 'clubs'); await denied('getEmergencyContact', parent, { target }, 'PERMISSION_DENIED');
  await denied('saveEmergencyContact', parent, input({ ...fresh, revision: 1 }), 'PERMISSION_DENIED');
  await verify(); const current = await read(); assert.equal(current.childInstanceId, fresh.childInstanceId);
  assert.deepEqual(current.contact, changed); assert.equal(current.revision, 1);
});
await check('unbound-legacy-child-records-fail-closed-without-migration-fallback-or-data-loss', async () => {
  const legacy = db.collection('emergencyContacts').doc(legacyChildEmergencyContactId(childId));
  const { childInstanceId: omitted, ...record } = savedOriginal; assert(omitted);
  await legacy.create(record);
  await denied('getEmergencyContact', parent, { target }, 'FAILED_PRECONDITION');
  await denied('saveEmergencyContact', parent, input({ ...fresh, revision: 1 }), 'FAILED_PRECONDITION');
  assert.deepEqual((await legacy.get()).data(), record); await legacy.delete();
});
await check('a-malformed-instance-in-an-otherwise-valid-record-never-becomes-a-dial-destination', async () => {
  const ref = refFor(fresh), saved = (await ref.get()).data(); await ref.update({ childInstanceId: original.childInstanceId });
  await denied('getEmergencyContact', parent, { target }, 'FAILED_PRECONDITION');
  await denied('saveEmergencyContact', parent, input({ ...fresh, revision: 1 }), 'FAILED_PRECONDITION'); await ref.set(saved);
});
await check('self-contacts-retain-their-existing-key-and-replay-contract-without-child-markers', async () => {
  const data = { target: { kind: 'self' }, contact, expectedRevision: 0, requestId: randomUUID() };
  const result = await call('saveEmergencyContact', parent, data); assert.equal(result.revision, 1);
  assert.equal((await call('saveEmergencyContact', parent, data)).replayed, true);
  assert.equal((await db.collection('emergencyContacts').doc(emergencyContactId('self', parent.uid)).get()).get('contact.phone'), contact.phone);
  await denied('saveEmergencyContact', parent, { ...data, expectedChildInstanceId: fresh.childInstanceId }, 'INVALID_ARGUMENT');
  await denied('saveEmergencyContact', parent, { ...input(fresh), expectedChildInstanceId: undefined }, 'INVALID_ARGUMENT');
  assert.deepEqual((await auth.getUser(parent.uid)).customClaims, roles);
});
await check('a-concurrent-recreation-can-never-write-the-old-contact-into-the-new-child', async () => {
  const before = await read(), beforeRecord = (await refFor(before).get()).data();
  const outcomes = await Promise.allSettled([call('saveEmergencyContact', parent, input(before)), recreate(childId)]);
  assert.equal(outcomes[1].status, 'fulfilled');
  if (outcomes[0].status === 'rejected') assert(['PERMISSION_DENIED', 'FAILED_PRECONDITION'].includes(outcomes[0].reason.code));
  const oldRecord = (await refFor(before).get()).data(); assert([beforeRecord.revision, beforeRecord.revision + 1].includes(oldRecord.revision));
  await denied('getEmergencyContact', parent, { target }, 'PERMISSION_DENIED'); await verify();
  const latest = await read(); assert.notEqual(latest.childInstanceId, before.childInstanceId);
  assert.equal(latest.contact, null); assert.equal(latest.revision, 0); assert(!(await refFor(latest).get()).exists);
});
const files = ['functions/src/domain/emergencyContact.ts', 'functions/src/services/emergencyContactAuthority.ts',
  'functions/src/services/emergencyContact.ts', 'scripts/qa/local-emergency-identity-suite.mjs'];
writeFileSync(process.env.SGM_LOCAL_FLOW_OUTPUT, JSON.stringify({ scope: 'local-emulated-services-not-phone-ui',
  coverage: 'immutable-child-emergency-contact',
  projectId: 'demo-sgm-local-qa', runId: process.env.SGM_LOCAL_RUN_ID, testedAt: new Date().toISOString(), checks, steps: checks,
  productionWrites: false, nativeUiExecuted: false, physicalDevice: false, providerRequests: 0,
  sourceFiles: Object.fromEntries(files.map((file) => [file, createHash('sha256').update(readFileSync(resolve(import.meta.dirname, '../..', file))).digest('hex')]))
}, null, 2) + '\n', { flag: 'wx' });
console.log(`Passed ${checks.length} isolated immutable-child contact groups; no phone or release requirement accepted.`);

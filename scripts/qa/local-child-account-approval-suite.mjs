import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Timestamp } from 'firebase-admin/firestore';
import { deleteApp, getApp } from 'firebase-admin/app';
import { auth, call, db, denied } from './local-flow-client.mjs';
import { childAccountCodeHash } from '../../functions/lib/domain/childAccountApproval.js';
import { seedRideObservationFixture, verifyReadOnlyRideFixtureIsolation } from './local-ride-observation-fixture.mjs';
import { childEmergencyActors, verifyChildContactParent, saveChildChosenContact, withChildFixturePatch } from './child-emergency-fixture.mjs';
import { verifyChildContactDiscovery } from './child-contact-discovery-checks.mjs';

execFileSync(process.execPath, [resolve(import.meta.dirname, 'seed-firebase-emulator.mjs')],
  { env: process.env, stdio: ['ignore', 'pipe', 'pipe'], timeout: 90_000 });
const actors = await childEmergencyActors(), ride = await seedRideObservationFixture();
const childId = ride.childId, clubId = 'sgm-qa-club-green-wavre';
const linkRef = db.collection('childAccountLinks').doc(actors.child.uid);
await linkRef.delete();
const claims = async () => (await auth.listUsers()).users.map(row => ({ uid: row.uid, claims: row.customClaims })).sort((a, b) => a.uid.localeCompare(b.uid));
const beforeClaims = await claims();
const unrelatedNames = ['teams', 'messages', 'chatInboxes', 'teamEnrollments', 'teamEnrollmentEvents'];
const snapshot = async () => Object.fromEntries(await Promise.all(unrelatedNames.map(async name => [name,
  (await db.collection(name).get()).docs.map(row => ({ id: row.id, data: row.data() })).sort((a, b) => a.id.localeCompare(b.id))])));
const before = await snapshot(), steps = [];
const check = async (id, action) => { await action(); steps.push({ id, status: 'passed' }); };
let code, input, requestRef, retiredCode, failure, isolation, discovery;
const approve = (actor = actors.parent, payload = input) => call('approveChildAccountLink', actor, payload);
try {
  await check('only-an-existing-child-account-can-create-a-code-without-role-escalation', async () => {
    for (const actor of [null, actors.parent, actors.manager, actors.driver])
      await denied('createChildAccountLinkCode', actor, {}, actor ? 'PERMISSION_DENIED' : 'UNAUTHENTICATED');
    await denied('createChildAccountLinkCode', actors.child, { accountUserId: actors.other.uid }, 'INVALID_ARGUMENT');
    code = await call('createChildAccountLinkCode', actors.child, {});
    assert.equal(code.accountUserId, actors.child.uid); assert.match(code.code, /^[a-f0-9]{32}$/);
    assert(code.expiresAtMillis > Date.now() && code.expiresAtMillis <= Date.now() + 600_000);
    requestRef = db.collection('childAccountApprovalRequests').doc(childAccountCodeHash(code.code));
  });
  await check('the-code-is-hashed-at-rest-and-explicit-regeneration-is-rate-limited', async () => {
    const request = await requestRef.get(), owner = await db.collection('childAccountApprovalOwners').doc(actors.child.uid).get();
    assert.equal(request.get('accountUserId'), actors.child.uid); assert.equal(owner.get('codeHash'), request.id);
    assert(!JSON.stringify([request.data(), owner.data()]).includes(code.code));
    await denied('createChildAccountLinkCode', actors.child, {}, 'RESOURCE_EXHAUSTED');
    retiredCode = code.code;
    await owner.ref.update({ createdAt: Timestamp.fromMillis(0) });
    code = await call('createChildAccountLinkCode', actors.child, {});
    assert.notEqual(code.code, retiredCode); assert(!(await requestRef.get()).exists);
    requestRef = db.collection('childAccountApprovalRequests').doc(childAccountCodeHash(code.code));
  });
  await check('a-parent-must-be-separately-verified-before-approving-the-child-device', async () => {
    input = { code: code.code, childId, clubId, expectedChildInstanceId: 'a'.repeat(64) };
    await denied('approveChildAccountLink', actors.parent, input, 'PERMISSION_DENIED');
    assert(!(await linkRef.get()).exists);
    await verifyChildContactParent(actors, childId, clubId);
    const contact = await saveChildChosenContact(actors.parent, childId, clubId);
    input.expectedChildInstanceId = contact.childInstanceId;
    await denied('approveChildAccountLink', actors.parent, { ...input, code: retiredCode }, 'PERMISSION_DENIED');
  });
  await check('a-manager-stranger-or-child-cannot-approve-and-client-selected-account-ids-are-refused', async () => {
    for (const actor of [null, actors.manager, actors.driver, actors.child, actors.other])
      await denied('approveChildAccountLink', actor, input, actor ? 'PERMISSION_DENIED' : 'UNAUTHENTICATED');
    await denied('approveChildAccountLink', actors.parent, { ...input, accountUserId: actors.other.uid }, 'INVALID_ARGUMENT');
    await denied('approveChildAccountLink', actors.parent, { ...input, expectedChildInstanceId: 'a'.repeat(64) }, 'FAILED_PRECONDITION');
  });
  await check('an-expired-or-unknown-code-cannot-create-a-link', async () => {
    await withChildFixturePatch(requestRef, { expiresAt: Timestamp.fromMillis(0) }, () =>
      denied('approveChildAccountLink', actors.parent, input, 'FAILED_PRECONDITION'));
    await denied('approveChildAccountLink', actors.parent, { ...input, code: '0'.repeat(32) }, 'PERMISSION_DENIED');
    assert(!(await linkRef.get()).exists);
  });
  await check('current-parent-and-child-roles-and-parent-membership-are-rechecked', async () => {
    for (const [ref, patch] of [
      [db.collection('users').doc(actors.parent.uid), { roles: { parent: false } }],
      [db.collection('users').doc(actors.child.uid), { roles: { child: true, parent: true } }],
      [db.collection('memberships').doc(`${actors.parent.uid}_${clubId}`), { active: false }],
      [db.collection('children').doc(childId), { guardianUserIds: [] }],
    ]) await withChildFixturePatch(ref, patch, () => denied('approveChildAccountLink', actors.parent, input, 'PERMISSION_DENIED'));
    assert(!(await linkRef.get()).exists);
  });
  await check('concurrent-approvals-produce-one-parent-approved-immutable-link-and-an-idempotent-receipt', async () => {
    const receipts = await Promise.all([approve(), approve()]);
    assert.deepEqual(receipts.map(row => row.replayed).sort(), [false, true]);
    const link = await linkRef.get();
    assert.equal(link.get('verifiedByUserId'), actors.parent.uid); assert.equal(link.get('accountUserId'), actors.child.uid);
    assert.equal(link.get('childId'), childId); assert.equal(link.get('childInstanceId'), input.expectedChildInstanceId);
    assert.equal((await requestRef.get()).get('status'), 'approved');
  });
  await check('the-approved-child-account-can-read-its-parent-chosen-contact-for-the-current-ride', async () => {
    const view = await call('getChildRideEmergencyContact', actors.child, { rideSessionId: ride.rideSessionId });
    assert.equal(view.accountUserId, actors.child.uid); assert.equal(view.subjectId, childId); assert.notEqual(childId, actors.child.uid);
    assert.equal(view.contact.phone, '+12025550121');
    discovery = await verifyChildContactDiscovery(actors, ride, clubId);
    await denied('createChildAccountLinkCode', actors.child, {}, 'FAILED_PRECONDITION');
  });
  await check('a-consumed-code-cannot-rebind-an-account-or-replay-after-the-parent-loses-authority', async () => {
    await withChildFixturePatch(db.collection('children').doc(childId), { guardianUserIds: [] }, async () => {
      await denied('approveChildAccountLink', actors.parent, input, 'PERMISSION_DENIED');
      await denied('getChildRideEmergencyContact', actors.child, { rideSessionId: ride.rideSessionId }, 'PERMISSION_DENIED');
    });
    await withChildFixturePatch(linkRef, { status: 'revoked' }, () => denied('approveChildAccountLink', actors.parent, input, 'PERMISSION_DENIED'));
    assert.equal((await approve()).replayed, true);
  });
  await check('other-records-account-claims-and-the-owned-ride-remain-unchanged', async () => {
    assert.deepEqual(await claims(), beforeClaims); assert.deepEqual(await snapshot(), before);
    isolation = await verifyReadOnlyRideFixtureIsolation(ride);
    assert.equal((await db.collection('childAccountLinks').get()).size, 1);
    assert.equal((await db.collection('childAccountApprovalRequests').get()).size, 1);
    assert.equal((await db.collection('childAccountApprovalOwners').get()).size, 1);
  });
} catch (error) { failure = error; }
finally { await deleteApp(getApp()); }
const paths = ['functions/src/domain/childAccountApproval.ts', 'functions/src/services/childAccountApproval.ts',
  'functions/src/callables/childAccountApproval.ts', 'scripts/qa/local-child-account-approval-suite.mjs', 'firestore.rules',
  'scripts/qa/child-contact-discovery-checks.mjs', 'functions/src/services/childRideEmergencyContact.ts',
  'functions/src/callables/emergencyContact.ts'];
writeFileSync(process.env.SGM_LOCAL_FLOW_OUTPUT, JSON.stringify({ projectId: 'demo-sgm-local-qa', runId: process.env.SGM_LOCAL_RUN_ID,
  testedAt: new Date().toISOString(), scope: 'local-authenticated-parent-account-approval-not-signup-or-native-navigation',
  steps, testCount: steps.length, childAccountLinkPreseeded: false, childAccountApprovalFlowExecuted: true,
  nativeUiExecuted: false, physicalDevice: false, productionWrites: false, providerRequests: 0, adminClientClosed: true,
  isolation, discovery, sourceFiles: Object.fromEntries(paths.map(path => [path,
    createHash('sha256').update(readFileSync(resolve(import.meta.dirname, '../..', path))).digest('hex')])) }, null, 2) + '\n', { flag: 'wx' });
if (failure) throw failure;
console.log('Ten authenticated child-account approval groups passed without provisioning or changing account roles.');

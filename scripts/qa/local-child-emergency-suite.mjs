import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import { deleteApp, getApp } from 'firebase-admin/app';
import { auth, call, db, denied } from './local-flow-client.mjs';
import { guardianVerificationId } from '../../functions/lib/domain/guardianVerification.js';
import { legacyChildEmergencyContactId } from '../../functions/lib/domain/emergencyContact.js';
import { seedRideObservationFixture, verifyReadOnlyRideFixtureIsolation } from './local-ride-observation-fixture.mjs';
import { childEmergencyActors, childContact, seedChildAccountLink, verifyChildContactParent, saveChildChosenContact, withChildFixturePatch } from './child-emergency-fixture.mjs';

execFileSync(process.execPath, [resolve(import.meta.dirname, 'seed-firebase-emulator.mjs')],
  { env: process.env, stdio: ['ignore', 'pipe', 'pipe'], timeout: 90_000 });
const actors = await childEmergencyActors(), firstRide = await seedRideObservationFixture();
const childId = firstRide.childId, clubId = 'sgm-qa-club-green-wavre';
const read = (rideSessionId = firstRide.rideSessionId, actor = actors.child) => call('getChildRideEmergencyContact', actor, { rideSessionId });
const reject = (code = 'PERMISSION_DENIED', rideSessionId = firstRide.rideSessionId) =>
  denied('getChildRideEmergencyContact', actors.child, { rideSessionId }, code);
const childRef = db.collection('children').doc(childId), clubRef = db.collection('clubs').doc(clubId);
const verificationId = guardianVerificationId(clubId, childId, actors.parent.uid);
const verification = db.collection('guardianVerifications').doc(verificationId);
const names = ['users', 'children', 'clubs', 'memberships', 'teams', 'messages', 'chatInboxes', 'guardianVerifications',
  'guardianVerificationEvents', 'teamEnrollments', 'teamEnrollmentEvents', 'childAccountLinks'];
const snapshot = async () => Object.fromEntries(await Promise.all(names.map(async (name) => [name,
  (await db.collection(name).orderBy('__name__').get()).docs.map((row) => ({ id: row.id, data: row.data() }))])));
const claims = async () => (await auth.listUsers()).users.map((user) => ({ uid: user.uid, claims: user.customClaims })).sort((a, b) => a.uid.localeCompare(b.uid));
const before = await snapshot(), beforeClaims = await claims(), steps = [];
const check = async (id, action) => {
  try { await action(); steps.push({ id, status: 'passed' }); }
  catch (error) { steps.push({ id, status: 'failed' }); throw error; }
};
let saved, secondRide, firstIsolation, secondIsolation, failure;
try {
  await check('child-reads-only-its-active-ride-with-an-explicit-empty-contact', async () => {
    const view = await read(); assert.equal(view.subjectId, childId); assert.equal(view.contact, null); assert.equal(view.revision, 0);
    assert.equal(view.accountUserId, actors.child.uid); assert.notEqual(view.subjectId, actors.child.uid);
  });
  await check('separately-verified-parent-choice-persists-its-authorization-provenance', async () => {
    await verifyChildContactParent(actors, childId, clubId);
    saved = await saveChildChosenContact(actors.parent, childId, clubId);
    assert.equal((await db.collection('emergencyContacts').doc(saved.contactId).get()).get('guardianClubId'), clubId);
    const view = await read(); assert.deepEqual(view.contact, childContact); assert.equal(view.revision, 1);
    assert.deepEqual(Object.keys(view).sort(), ['accountUserId', 'childInstanceId', 'childName', 'contact', 'revision', 'rideSessionId', 'subjectId']);
  });
  await check('strangers-adults-and-spoofed-child-identities-cannot-read-the-contact', async () => {
    for (const actor of [null, actors.parent, actors.driver, actors.manager, actors.other])
      await denied('getChildRideEmergencyContact', actor, { rideSessionId: firstRide.rideSessionId }, actor === null ? 'UNAUTHENTICATED' : 'PERMISSION_DENIED');
    for (const patch of [{ childId: 'another-child' }, { parentUserId: actors.parent.uid }, { guardianClubId: clubId }])
      await denied('getChildRideEmergencyContact', actors.child, { rideSessionId: firstRide.rideSessionId, ...patch }, 'INVALID_ARGUMENT');
  });
  await check('the-child-read-capability-never-enables-self-or-child-contact-writes', async () => {
    for (const target of [{ kind: 'self' }, { kind: 'child', childId, clubId }])
      await denied('saveEmergencyContact', actors.child, { target, expectedRevision: 1, requestId: randomUUID(), contact: childContact,
        ...(target.kind === 'child' ? { expectedChildInstanceId: saved.childInstanceId } : {}) }, 'PERMISSION_DENIED');
  });
  await check('a-separate-server-owned-child-account-link-is-required-current-and-revocable', async () => {
    const ref = db.collection('childAccountLinks').doc(actors.child.uid), original = await ref.get();
    try { await ref.delete(); await reject(); } finally { await ref.set(original.data()); }
    for (const patch of [{ status: 'revoked' }, { accountUserId: 'another-account' }, { childId: 'another-profile' },
      { childInstanceId: 'a'.repeat(64) }, { verifiedAt: Timestamp.fromMillis(0) }, { verifiedByUserId: actors.child.uid }])
      await withChildFixturePatch(ref, patch, () => reject());
  });
  await check('inactive-foreign-and-pre-profile-ride-identities-fail-closed', async () => {
    const ref = db.collection('rideSessions').doc(firstRide.rideSessionId);
    for (const patch of [{ status: 'completed' }, { childUserIds: [] }, { passengers: [] }, { startedAt: Timestamp.fromMillis(0) }])
      await withChildFixturePatch(ref, patch, () => reject());
  });
  await check('manager-revocation-blocks-the-child-until-a-new-explicit-parent-verification', async () => {
    await call('transitionGuardianVerification', actors.manager, { clubId, childId, parentUserId: actors.parent.uid,
      action: 'revoke', expectedRevision: 2, requestId: randomUUID() }); await reject();
    await verifyChildContactParent(actors, childId, clubId); assert.deepEqual((await read()).contact, childContact);
  });
  await check('removing-the-current-parent-child-relationship-revokes-child-reading', async () => {
    await withChildFixturePatch(childRef, { guardianUserIds: [] }, () => reject());
  });
  await check('current-parent-role-membership-and-club-status-are-rechecked-on-every-read', async () => {
    await withChildFixturePatch(db.collection('memberships').doc(`${actors.parent.uid}_${clubId}`), { active: false }, () => reject());
    for (const roles of [{ parent: false }, { parent: true, child: true }])
      await withChildFixturePatch(db.collection('users').doc(actors.parent.uid), { roles }, () => reject());
    for (const status of ['archived', 'unknown']) await withChildFixturePatch(clubRef, { status }, () => reject());
  });
  await check('missing-or-unrelated-parent-provenance-never-becomes-an-empty-or-guessed-contact', async () => {
    const ref = db.collection('emergencyContacts').doc(saved.contactId);
    await withChildFixturePatch(ref, { guardianClubId: FieldValue.delete() }, () => reject('FAILED_PRECONDITION'));
    await withChildFixturePatch(ref, { guardianClubId: 'other-club' }, () => reject());
  });
  await check('malformed-contact-and-immutable-child-markers-are-refused', async () => {
    const ref = db.collection('emergencyContacts').doc(saved.contactId);
    for (const patch of [{ contact: { name: 'QA', phone: '112' } }, { childInstanceId: 'a'.repeat(64) }])
      await withChildFixturePatch(ref, patch, () => reject('FAILED_PRECONDITION'));
  });
  await check('legacy-contact-presence-requires-explicit-review-without-fallback-or-data-loss', async () => {
    const ref = db.collection('emergencyContacts').doc(legacyChildEmergencyContactId(childId)); assert(!(await ref.get()).exists);
    try { await ref.create({ note: 'Unbound synthetic legacy record' }); await reject('FAILED_PRECONDITION'); }
    finally { await ref.delete(); }
  });
  await check('explicit-parent-removal-is-versioned-and-does-not-authorize-a-phone-destination', async () => {
    await saveChildChosenContact(actors.parent, childId, clubId, null);
    const removed = await read(); assert.equal(removed.contact, null); assert.equal(removed.revision, 2);
    saved = await saveChildChosenContact(actors.parent, childId, clubId); assert.equal((await read()).revision, 3);
  });
  await check('recreating-the-verification-club-requires-a-fresh-manager-decision', async () => {
    const original = await clubRef.get(); await clubRef.delete(); await clubRef.create(original.data()); await reject();
    await verifyChildContactParent(actors, childId, clubId); assert.deepEqual((await read()).contact, childContact);
    firstIsolation = await verifyReadOnlyRideFixtureIsolation(firstRide);
  });
  await check('a-recreated-child-never-inherits-an-old-ride-or-the-prior-contact', async () => {
    const oldContact = (await db.collection('emergencyContacts').doc(saved.contactId).get()).data();
    const original = await childRef.get(); await childRef.delete(); await childRef.create(original.data()); await reject();
    await verifyChildContactParent(actors, childId, clubId); secondRide = await seedRideObservationFixture();
    await reject('PERMISSION_DENIED', secondRide.rideSessionId);
    await seedChildAccountLink(actors.child.uid, childId, actors.manager.uid);
    const fresh = await read(secondRide.rideSessionId); assert.equal(fresh.contact, null); assert.equal(fresh.revision, 0);
    assert.notEqual(fresh.childInstanceId, saved.childInstanceId);
    const contact = { name: 'Nouveau contact enfant QA', phone: '+12025550122' };
    await saveChildChosenContact(actors.parent, childId, clubId, contact);
    assert.deepEqual((await read(secondRide.rideSessionId)).contact, contact); await reject();
    assert.deepEqual((await db.collection('emergencyContacts').doc(saved.contactId).get()).data(), oldContact);
  });
  await check('other-records-claims-live-rides-and-private-operation-counts-remain-protected', async () => {
    secondIsolation = await verifyReadOnlyRideFixtureIsolation(secondRide);
    const after = await snapshot();
    const selected = (name, rows) => rows.filter((row) => !(name === 'children' && row.id === childId ||
      name === 'clubs' && row.id === clubId || name === 'childAccountLinks' && row.id === actors.child.uid || name === 'guardianVerifications' && row.id === verificationId ||
      name === 'guardianVerificationEvents' && row.data.verificationId === verificationId));
    for (const name of names) assert.deepEqual(selected(name, after[name]), selected(name, before[name]), name);
    assert.deepEqual(await claims(), beforeClaims);
    assert.equal((await db.collection('emergencyContacts').get()).size, 2);
    assert.equal((await db.collection('emergencyContactOperations').get()).size, 4);
    assert.equal((await verification.get()).get('revision'), 11);
  });
} catch (error) { failure = error; }
finally { await deleteApp(getApp()); }
const paths = ['functions/src/domain/emergencyContact.ts', 'functions/src/services/emergencyContact.ts',
  'functions/src/domain/childAccountLink.ts', 'firestore.rules',
  'functions/src/services/childRideEmergencyContact.ts', 'functions/src/callables/emergencyContact.ts',
  'scripts/qa/local-child-emergency-suite.mjs', 'scripts/qa/child-emergency-fixture.mjs', 'scripts/qa/run-local-child-emergency.mjs'];
writeFileSync(process.env.SGM_LOCAL_FLOW_OUTPUT, JSON.stringify({ projectId: 'demo-sgm-local-qa', runId: process.env.SGM_LOCAL_RUN_ID,
  testedAt: new Date().toISOString(), scope: 'local-child-read-service-not-native-or-dialer', steps, testCount: steps.length,
  firstIsolation, secondIsolation, adminClientClosed: true, physicalDevice: false, nativeUiExecuted: false, dialerOpened: false,
  productionWrites: false, providerRequests: 0, childAccountLinkPreseeded: true, childAccountApprovalFlowExecuted: false,
  sourceFiles: Object.fromEntries(paths.map((path) =>
    [path, createHash('sha256').update(readFileSync(resolve(import.meta.dirname, '../..', path))).digest('hex')])) }, null, 2) + '\n', { flag: 'wx' });
if (failure) throw failure;
console.log('Sixteen actual child contact read groups passed; account-link approval, native UI, dialer and physical trials remain unverified.');

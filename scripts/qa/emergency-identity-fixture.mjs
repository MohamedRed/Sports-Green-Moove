import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { getDatabase } from 'firebase-admin/database';
import { auth, call, db, signIn } from './local-flow-client.mjs';
import { emergencyChildInstanceId, emergencyContactId } from '../../functions/lib/domain/emergencyContact.js';
import { seedEmergencyNativeFixture } from './local-emergency-native-fixture.mjs';

const names = ['users', 'children', 'clubs', 'memberships', 'teams', 'trips', 'bookings', 'rideSessions', 'messages',
  'chatInboxes', 'notifications', 'co2Ledger', 'rewardLedger', 'guardianVerifications', 'guardianVerificationEvents'];
const rows = async (name) => (await db.collection(name).orderBy('__name__').get()).docs.map((doc) => ({ id: doc.id, data: doc.data() }));
const claims = () => Promise.all(['sgm-qa-parent', 'sgm-qa-driver', 'sgm-qa-club-manager'].map(async (uid) =>
  ({ uid, claims: (await auth.getUser(uid)).customClaims })));
export async function prepareEmergencyIdentityFixture() {
  const fixture = await seedEmergencyNativeFixture();
  return { ...fixture, baseline: Object.fromEntries(await Promise.all(names.map(async (name) => [name, await rows(name)]))),
    claims: await claims(), liveTrips: (await getDatabase().ref('liveTrips').get()).val() };
}
export async function recreateEmergencyIdentity(fixture) {
  const old = await db.collection('emergencyContacts').doc(fixture.contactIds[1]).get();
  assert.deepEqual(old.get('contact'), { name: 'Ancien contact QA', phone: '+12025550127' });
  assert.equal(old.get('revision'), 1); fixture.originalContact = old.data();
  const ref = db.collection('children').doc(fixture.childId), before = await ref.get();
  await ref.delete(); await ref.create({ ...before.data(), displayName: 'Enfant recréé QA' });
  const after = await ref.get(); assert(!before.createTime.isEqual(after.createTime));
  fixture.newInstanceId = emergencyChildInstanceId(fixture.childId, after.createTime);
  assert.notEqual(fixture.newInstanceId, fixture.childInstanceId);
}
export async function verifyEmergencyIdentityParent(fixture) {
  const parent = await signIn('p@example.test'), manager = await signIn('c@example.test');
  const ref = db.collection('guardianVerifications').doc(fixture.verificationId);
  const contact = await db.collection('emergencyContacts').doc(fixture.contactIds[1]).get();
  assert.deepEqual(contact.data(), fixture.originalContact);
  assert.equal((await db.collection('emergencyContacts').get()).size, 1);
  assert.equal((await db.collection('emergencyContactOperations').get()).size, 1);
  for (const [actor, action] of [[manager, 'revoke'], [parent, 'request'], [manager, 'verify']])
    await call('transitionGuardianVerification', actor, { clubId: fixture.clubId, childId: fixture.childId,
      parentUserId: parent.uid, action, expectedRevision: (await ref.get()).get('revision'), requestId: randomUUID() });
}
export async function verifyEmergencyIdentityStoredState(fixture) {
  assert(fixture.originalContact && fixture.newInstanceId);
  const records = await rows('emergencyContacts'), operations = await rows('emergencyContactOperations');
  const nextId = emergencyContactId('child', fixture.childId, fixture.newInstanceId);
  assert.deepEqual(records.map((row) => row.id).sort(), [fixture.contactIds[1], nextId].sort());
  assert.deepEqual(records.find((row) => row.id === fixture.contactIds[1]).data, fixture.originalContact);
  const current = records.find((row) => row.id === nextId).data;
  assert.equal(current.subjectId, fixture.childId); assert.equal(current.childInstanceId, fixture.newInstanceId);
  assert.equal(current.lastActorUserId, 'sgm-qa-parent'); assert.equal(current.revision, 1);
  assert.deepEqual(current.contact, { name: 'Nouveau contact QA', phone: '+12025550129' });
  assert.equal(operations.length, 2);
  for (const id of [fixture.contactIds[1], nextId]) {
    const matching = operations.filter((row) => row.data.contactId === id); assert.equal(matching.length, 1);
    assert.equal(matching[0].data.actorUserId, 'sgm-qa-parent'); assert.equal(matching[0].data.revision, 1);
  }
  const decision = await db.collection('guardianVerifications').doc(fixture.verificationId).get();
  assert.equal(decision.get('status'), 'verified'); assert.equal(decision.get('revision'), 5);
  assert.equal(decision.get('lastActorUserId'), 'sgm-qa-club-manager');
  const exclude = (name, rows) => rows.filter((row) => !(name === 'children' && row.id === fixture.childId ||
    name === 'guardianVerifications' && row.id === fixture.verificationId ||
    name === 'guardianVerificationEvents' && row.data.verificationId === fixture.verificationId));
  for (const name of names) assert.deepEqual(exclude(name, await rows(name)), exclude(name, fixture.baseline[name]), name);
  const events = (await rows('guardianVerificationEvents')).filter((row) => row.data.verificationId === fixture.verificationId);
  assert.equal(events.length, 5);
  assert.deepEqual(events.map((row) => row.data.revision).sort(), [1, 2, 3, 4, 5]);
  assert.deepEqual(await claims(), fixture.claims);
  assert.deepEqual((await getDatabase().ref('liveTrips').get()).val(), fixture.liveTrips);
  return { baselineRecordsPreserved: true, claimsUnchanged: true, baselineCollectionCount: names.length,
    contactCount: 2, contactOperationCount: 2, guardianEventCount: 5, oldContactPreserved: true };
}

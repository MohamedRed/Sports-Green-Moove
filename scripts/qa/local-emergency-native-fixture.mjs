import assert from 'node:assert/strict';
import { Timestamp } from 'firebase-admin/firestore';
import { auth, db } from './local-flow-client.mjs';
import { emergencyContactId } from '../../functions/lib/domain/emergencyContact.js';
import { guardianOperationId, guardianVerificationId } from '../../functions/lib/domain/guardianVerification.js';

const parentId = 'sgm-qa-parent', childId = 'sgm-qa-emergency-child', clubId = 'sgm-qa-club-green-wavre';
const verificationId = guardianVerificationId(clubId, childId, parentId);
const contactIds = [emergencyContactId('self', parentId), emergencyContactId('child', childId)];
const rows = async (name) => (await db.collection(name).orderBy('__name__').get()).docs.map((doc) => ({ id: doc.id, ...doc.data() }));
async function protectedState() {
  const state = {};
  for (const name of ['children', 'clubs', 'memberships', 'teams', 'bookings', 'notifications', 'guardianVerifications', 'guardianVerificationEvents'])
    state[name] = await rows(name);
  state.roles = await Promise.all([parentId, 'sgm-qa-driver', 'sgm-qa-club-manager'].map(async (uid) => ({ uid, claims: (await auth.getUser(uid)).customClaims })));
  return state;
}

export async function seedEmergencyNativeFixture() {
  assert.equal((await db.collection('emergencyContacts').get()).size, 0);
  assert.equal((await db.collection('emergencyContactOperations').get()).size, 0);
  assert(!(await db.collection('children').doc(childId).get()).exists);
  assert(!(await db.collection('guardianVerifications').doc(verificationId).get()).exists);
  const before = await protectedState(), now = Timestamp.now();
  const batch = db.batch();
  batch.create(db.collection('children').doc(childId), { displayName: 'Enfant urgence QA', firstName: 'Enfant',
    guardianUserIds: [parentId], clubId, createdAt: now, updatedAt: now });
  batch.create(db.collection('guardianVerifications').doc(verificationId), { childId, parentUserId: parentId, clubId,
    status: 'verified', revision: 2, lastActorUserId: 'sgm-qa-club-manager', createdAt: now, updatedAt: now });
  await batch.commit();
  return { verificationId, before, seeded: await protectedState() };
}

export async function verifyEmergencyNativeFixture(fixture, marker) {
  const own = await db.collection('emergencyContacts').doc(contactIds[0]).get();
  assert.equal(own.get('kind'), 'self'); assert.equal(own.get('subjectId'), parentId);
  assert.equal(own.get('revision'), 2); assert.equal(own.get('contact'), null); assert.equal(own.get('lastActorUserId'), parentId);
  const child = await db.collection('emergencyContacts').doc(contactIds[1]).get();
  assert.equal(child.get('kind'), 'child'); assert.equal(child.get('subjectId'), childId); assert.equal(child.get('revision'), 1);
  assert.deepEqual(child.get('contact'), { name: 'Contact enfant QA', phone: '+12025550124' });
  assert.equal(child.get('lastActorUserId'), parentId); assert.equal((await db.collection('emergencyContacts').get()).size, 2);
  const operations = await rows('emergencyContactOperations'); assert.equal(operations.length, 3);
  assert(operations.every((op) => op.actorUserId === parentId && contactIds.includes(op.contactId)));
  assert.deepEqual(operations.filter((op) => op.contactId === contactIds[0]).map((op) => op.revision).sort(), [1, 2]);
  assert.deepEqual(operations.filter((op) => op.contactId === contactIds[1]).map((op) => op.revision), [1]);
  const record = await db.collection('guardianVerifications').doc(verificationId).get();
  assert.equal(record.get('status'), 'revoked'); assert.equal(record.get('revision'), 3);
  assert.equal(record.get('lastActorUserId'), 'sgm-qa-club-manager');
  const events = await rows('guardianVerificationEvents'), previousEvents = fixture.before.guardianVerificationEvents;
  const added = events.filter((event) => !previousEvents.some((before) => before.id === event.id)); assert.equal(added.length, 1);
  const event = added[0]; assert.equal(event.id, guardianOperationId('sgm-qa-club-manager', marker.managerRevokeRequestId));
  assert.equal(event.verificationId, verificationId); assert.equal(event.actorUserId, 'sgm-qa-club-manager');
  assert.equal(event.action, 'revoke'); assert.equal(event.previousStatus, 'verified'); assert.equal(event.status, 'revoked'); assert.equal(event.revision, 3);
  const after = await protectedState();
  for (const name of Object.keys(after).filter((key) => !['guardianVerifications', 'guardianVerificationEvents'].includes(key)))
    assert.deepEqual(after[name], fixture.seeded[name], name);
  assert.deepEqual(after.guardianVerifications.filter((row) => row.id !== verificationId), fixture.before.guardianVerifications);
  assert.deepEqual(events.filter((row) => row.id !== event.id), previousEvents);
}

export async function cleanupEmergencyNativeFixture(fixture) {
  const batch = db.batch();
  batch.delete(db.collection('children').doc(childId)); batch.delete(db.collection('guardianVerifications').doc(verificationId));
  for (const id of contactIds) batch.delete(db.collection('emergencyContacts').doc(id));
  for (const row of await rows('emergencyContactOperations')) if (contactIds.includes(row.contactId))
    batch.delete(db.collection('emergencyContactOperations').doc(row.id));
  for (const row of await rows('guardianVerificationEvents')) if (row.verificationId === verificationId)
    batch.delete(db.collection('guardianVerificationEvents').doc(row.id));
  await batch.commit();
  assert.deepEqual(await protectedState(), fixture.before);
  assert.equal((await db.collection('emergencyContacts').get()).size, 0);
  assert.equal((await db.collection('emergencyContactOperations').get()).size, 0);
}

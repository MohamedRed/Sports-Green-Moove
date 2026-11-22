import assert from 'node:assert/strict';
import { Timestamp } from 'firebase-admin/firestore';
import { call, db, denied } from './local-flow-client.mjs';
import { withChildFixturePatch } from './child-emergency-fixture.mjs';
import { guardianVerificationId } from '../../functions/lib/domain/guardianVerification.js';

export async function verifyChildContactDiscovery(actors, ride, clubId) {
  const endpoint = 'getCurrentChildRideEmergencyContact', childId = ride.childId;
  const discover = () => call(endpoint, actors.child, {});
  const contact = await call('getChildRideEmergencyContact', actors.child, { rideSessionId: ride.rideSessionId });
  assert.notEqual(actors.child.uid, childId);
  assert.deepEqual(await discover(), { accountUserId: actors.child.uid, current: contact });
  assert.deepEqual(Object.keys(contact).sort(), ['accountUserId', 'childInstanceId', 'childName', 'contact',
    'revision', 'rideSessionId', 'subjectId'].sort());
  for (const actor of [null, actors.parent, actors.manager, actors.driver])
    await denied(endpoint, actor, {}, actor ? 'PERMISSION_DENIED' : 'UNAUTHENTICATED');
  for (const payload of [{ childId }, { accountUserId: actors.child.uid }, { rideSessionId: ride.rideSessionId }])
    await denied(endpoint, actors.child, payload, 'INVALID_ARGUMENT');
  const link = db.collection('childAccountLinks').doc(actors.child.uid);
  const patches = [
    [link, { status: 'revoked' }], [link, { childInstanceId: '0'.repeat(64) }],
    [link, { verifiedAt: Timestamp.fromMillis(0) }],
    [db.collection('users').doc(actors.child.uid), { roles: { child: false } }],
    [db.collection('users').doc(actors.child.uid), { roles: { child: true, parent: true } }],
    [db.collection('users').doc(actors.parent.uid), { roles: { parent: false } }],
    [db.collection('children').doc(childId), { guardianUserIds: [] }],
    [db.collection('memberships').doc(`${actors.parent.uid}_${clubId}`), { active: false }],
    [db.collection('clubs').doc(clubId), { status: 'suspended' }],
    [db.collection('guardianVerifications').doc(guardianVerificationId(clubId, childId, actors.parent.uid)), { status: 'revoked' }],
    [db.collection('rideSessions').doc(ride.rideSessionId), { passengers: [] }],
    [db.collection('rideSessions').doc(ride.rideSessionId), { startedAt: Timestamp.fromMillis(0) }],
  ];
  for (const [ref, patch] of patches) await withChildFixturePatch(ref, patch, async () => {
    await denied(endpoint, actors.child, {}, 'PERMISSION_DENIED');
    await denied('getChildRideEmergencyContact', actors.child, { rideSessionId: ride.rideSessionId }, 'PERMISSION_DENIED');
  });
  await withChildFixturePatch(db.collection('rideSessions').doc(ride.rideSessionId), { status: 'completed' }, async () => {
    assert.deepEqual(await discover(), { accountUserId: actors.child.uid, current: null });
    await denied('getChildRideEmergencyContact', actors.child, { rideSessionId: ride.rideSessionId }, 'PERMISSION_DENIED');
  });
  const newer = db.collection('rideSessions').doc('sgm-qa-newer-child-contact');
  assert(!(await newer.get()).exists);
  try {
    await newer.create({ ...(await db.collection('rideSessions').doc(ride.rideSessionId).get()).data(),
      startedAt: Timestamp.now() });
    assert.equal((await discover()).current.rideSessionId, newer.id);
    await newer.update({ passengers: [] });
    await denied(endpoint, actors.child, {}, 'PERMISSION_DENIED');
  } finally { await newer.delete(); }
  assert.deepEqual((await discover()).current, contact);
  return { profileIdDiffersFromLogin: true, minimalOwnContactOnly: true, currentAuthorityPatches: patches.length,
    noActiveRideExplicit: true, newestRideSelected: true, invalidNewestRideDeniedWithoutFallback: true,
    knownRideRecheckPreserved: true, authenticatedServiceOnly: true };
}

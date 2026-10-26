import assert from 'node:assert/strict';
import { auth, call, db, signIn } from './local-flow-client.mjs';
import { seedRideObservationFixture } from './local-ride-observation-fixture.mjs';
import { childContact, saveChildChosenContact } from './child-emergency-fixture.mjs';

export async function prepareChildEmergencyPhoneFixture(identity) {
  const parent = await signIn(identity.parentEmail), child = await signIn(identity.childEmail);
  assert.equal(parent.uid, identity.parentUid); assert.equal(child.uid, identity.childUid);
  assert(!(await db.collection('childAccountLinks').doc(child.uid).get()).exists);
  const code = await call('createChildAccountLinkCode', child);
  await call('approveChildAccountLink', parent, { code: code.code, childId: identity.childId,
    clubId: identity.clubId, expectedChildInstanceId: identity.childInstanceId });
  code.code = '';
  const saved = await saveChildChosenContact(parent, identity.childId, identity.clubId);
  assert.equal(saved.revision, 1); assert.deepEqual(saved.contact, childContact);
  const ride = await seedRideObservationFixture(); assert.equal(ride.childId, identity.childId);
  assert.deepEqual((await auth.getUser(child.uid)).customClaims, { roleKeys: ['child'] });
  return { ...identity, tripId: ride.tripId, bookingId: ride.bookingId, rideSessionId: ride.rideSessionId,
    contact: childContact, accountProvisionedByFixture: true, accountApprovalMethod: 'authenticated-local-service',
    ridePreparationMethod: 'authenticated-local-service', contactPreparationMethod: 'authenticated-local-service',
    signupProven: false, parentUiProven: false, productionWrites: false, providerRequests: 0 };
}

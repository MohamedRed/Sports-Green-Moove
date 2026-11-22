import assert from 'node:assert/strict';

export const childEmergencyPhonePhases = ['child-signed-in', 'contact-shown', 'location-denied-contact', 'dialer-return', 'signed-out'];

export function verifyChildEmergencyPhoneCheckpoint(phase, baseline, current, fixture) {
  assert(childEmergencyPhonePhases.includes(phase));
  assert.notEqual(fixture.childUid, fixture.parentUid); assert.notEqual(fixture.childUid, fixture.childId);
  assert.match(fixture.childInstanceId, /^[a-f0-9]{64}$/);
  assert.deepEqual(current, baseline, 'Contact inspection must not alter accounts, links, rides, contacts or live data');
  const link = current.documents.childAccountLinks.find(row => row.id === fixture.childUid)?.data;
  assert.equal(link?.status, 'verified'); assert.equal(link.accountUserId, fixture.childUid);
  assert.equal(link.childId, fixture.childId); assert.equal(link.childInstanceId, fixture.childInstanceId);
  assert.equal(link.verifiedByUserId, fixture.parentUid);
  const result = current.contactView;
  assert.equal(result.accountUserId, fixture.childUid); assert(result.current);
  assert.equal(result.current.accountUserId, fixture.childUid);
  assert.equal(result.current.subjectId, fixture.childId);
  assert.equal(result.current.childInstanceId, fixture.childInstanceId);
  assert.equal(result.current.rideSessionId, fixture.rideSessionId);
  assert.deepEqual(result.current.contact, fixture.contact); assert.equal(result.current.revision, 1);
  assert(Object.hasOwn(current, 'liveData') && Array.isArray(current.claims));
  return { phase, status: 'passed', recordsUnchanged: true, accountClaimsUnchanged: true,
    currentContactRead: true, physicalUiProvenByThisCheckpoint: false,
    locationPermissionProvenByThisCheckpoint: false, dialerHandoffProvenByThisCheckpoint: false };
}

import assert from 'node:assert/strict';

export const emergencyPhonePhases = ['contact-empty', 'adult-saved', 'adult-restored', 'child-saved',
  'child-revoked', 'adult-dialer-return', 'adult-removed', 'other-account-empty'];

export function verifyEmergencyPhoneCheckpoint(phase, state, identity) {
  const index = emergencyPhonePhases.indexOf(phase); assert(index >= 0, 'Unknown contact checkpoint');
  const saved = index >= 1, childSaved = index >= 3, revoked = index >= 4, removed = index >= 6;
  assert.equal(state.contacts.length, Number(saved) + Number(childSaved));
  assert.equal(state.operations.length, Number(saved) + Number(childSaved) + Number(removed));
  for (const [position, expected, revision, contact] of [
    [0, saved, removed ? 2 : 1, removed ? null : { name: 'Contact adulte QA', phone: '+12025550123' }],
    [1, childSaved, 1, { name: 'Contact enfant QA', phone: '+12025550124' }],
  ]) {
    const record = state.contacts.find((row) => row.id === identity.contactIds[position]);
    if (!expected) { assert.equal(record, undefined); continue; }
    assert(record); assert.equal(record.kind, position === 0 ? 'self' : 'child');
    assert.equal(record.subjectId, position === 0 ? 'sgm-qa-parent' : identity.childId);
    assert.equal(record.childInstanceId, position === 0 ? undefined : identity.childInstanceId);
    assert.equal(record.revision, revision); assert.deepEqual(record.contact, contact);
    assert.equal(record.lastActorUserId, 'sgm-qa-parent');
    const operations = state.operations.filter((row) => row.contactId === record.id);
    assert.deepEqual(operations.map((row) => row.revision).sort(), position === 0 && removed ? [1, 2] : [1]);
    assert(operations.every((row) => row.actorUserId === 'sgm-qa-parent'));
  }
  assert.equal(state.guardian.status, revoked ? 'revoked' : 'verified');
  assert.equal(state.guardian.revision, revoked ? 3 : 2);
  assert.equal(state.guardian.lastActorUserId, 'sgm-qa-club-manager');
  return { phase, adultRevision: saved ? removed ? 2 : 1 : 0, childRevision: childSaved ? 1 : 0,
    operationCount: state.operations.length, guardianStatus: state.guardian.status };
}

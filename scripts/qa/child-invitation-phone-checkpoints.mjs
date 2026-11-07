import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

export const invitationPhonePhases = ['parent-signed-in', 'invitation-created', 'share-opened', 'share-returned', 'invitation-revoked', 'signed-out'];
export const invitationPhoneCollections = ['childAccountInvitations', 'childAccountInvitationOwners'];
const stamp = value => {
  assert.deepEqual(Object.keys(value).sort(), ['nanoseconds', 'seconds']);
  assert(Number.isSafeInteger(value.seconds) && Number.isInteger(value.nanoseconds));
  assert(value.seconds > 0 && value.nanoseconds >= 0 && value.nanoseconds < 1e9);
  return value.seconds * 1000 + value.nanoseconds / 1e6;
};
export function verifyInvitationPhoneCheckpoint(phase, baseline, current, fixture, previous) {
  assert(invitationPhonePhases.includes(phase));
  const rows = state => Object.fromEntries(invitationPhoneCollections.map(name => {
    assert(Array.isArray(state.documents[name])); return [name, state.documents[name]];
  }));
  const protectedRows = state => Object.fromEntries(Object.entries(state.documents).filter(([name]) => !invitationPhoneCollections.includes(name)));
  assert.deepEqual(current.claims, baseline.claims, 'Invitations cannot grant roles or create accounts');
  assert.deepEqual(current.liveData, baseline.liveData, 'Invitations cannot change live tracking');
  assert.deepEqual(protectedRows(current), protectedRows(baseline), 'Unrelated records changed');
  const initial = rows(baseline), actual = rows(current);
  assert(Object.values(initial).every(value => value.length === 0), 'The phone must create its own invitation');
  if (phase === 'parent-signed-in') assert.deepEqual(actual, initial);
  else {
    assert.equal(actual.childAccountInvitations.length, 1); assert.equal(actual.childAccountInvitationOwners.length, 1);
    const invitation = actual.childAccountInvitations[0], owner = actual.childAccountInvitationOwners[0];
    assert.match(invitation.id, /^[a-f0-9]{64}$/);
    const ownerId = createHash('sha256').update(JSON.stringify([fixture.childId, fixture.childInstanceId])).digest('hex');
    assert.equal(owner.id, ownerId); assert.equal(owner.data.invitationHash, invitation.id);
    assert.deepEqual(Object.keys(owner.data).sort(), ['createdAt', 'invitationHash']);
    const data = invitation.data, revoked = ['invitation-revoked', 'signed-out'].includes(phase);
    assert.deepEqual(Object.keys(data).sort(), ['parentUserId', 'childId', 'clubId', 'childInstanceId', 'ownerId',
      'status', 'createdAt', 'expiresAt', ...(revoked ? ['revokedAt'] : [])].sort());
    for (const key of ['childId', 'clubId', 'childInstanceId']) assert.equal(data[key], fixture[key]);
    assert.equal(data.parentUserId, fixture.parentUid); assert.equal(data.ownerId, ownerId);
    assert.equal(data.status, revoked ? 'revoked' : 'pending');
    assert.deepEqual(owner.data.createdAt, data.createdAt);
    assert.equal(Math.round(stamp(data.expiresAt) - stamp(data.createdAt)), 86_400_000);
    if (revoked) assert(stamp(data.revokedAt) >= stamp(data.createdAt));
    if (phase === 'invitation-revoked') {
      assert(previous); const before = rows(previous);
      assert.deepEqual(actual.childAccountInvitationOwners, before.childAccountInvitationOwners);
      const { status, revokedAt, ...after } = data;
      const { status: oldStatus, ...old } = before.childAccountInvitations[0].data;
      assert.equal(oldStatus, 'pending'); assert.deepEqual(after, old);
    }
  }
  if (['share-opened', 'share-returned', 'signed-out'].includes(phase)) {
    assert(previous); assert.deepEqual(current, previous, 'Sharing or leaving cannot mutate the invitation');
  }
  return { phase, status: 'passed', accountClaimsUnchanged: true, protectedRecordsUnchanged: true,
    systemShareProvenByThisCheckpoint: false, signupProven: false, parentApprovalProven: false };
}

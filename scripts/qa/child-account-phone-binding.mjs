import assert from 'node:assert/strict';

export function childPhoneInvitationHash(baseline, fixture) {
  const profile = baseline.documents.users.find(row => row.id === fixture.childUid)?.data;
  const claims = baseline.claims.find(row => row.uid === fixture.childUid)?.claims;
  const origin = (baseline.documents.childAccountInvitationAccounts ?? []).find(row => row.id === fixture.childUid)?.data;
  const hash = profile?.childInvitationHash;
  if (hash === undefined && claims?.childInvitationHash === undefined && !origin) return undefined;
  assert.match(hash ?? '', /^[a-f0-9]{64}$/);
  assert.equal(claims?.childInvitationHash, hash);
  assert.equal(origin?.invitationHash, hash);
  const invitation = (baseline.documents.childAccountInvitations ?? []).find(row => row.id === hash)?.data;
  assert.equal(invitation?.status, 'accepted');
  assert.equal(invitation.accountUserId, fixture.childUid);
  for (const field of ['childId', 'clubId', 'childInstanceId']) {
    assert.equal(invitation[field], fixture[field]);
    assert.equal(origin[field], fixture[field]);
  }
  assert.equal(invitation.parentUserId, fixture.parentUid);
  assert.equal(origin.parentUserId, fixture.parentUid);
  return hash;
}

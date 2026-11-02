import test from 'node:test';
import assert from 'node:assert/strict';
import { childPhoneInvitationHash } from '../scripts/qa/child-account-phone-binding.mjs';
import { childAccountPhonePhases, verifyChildAccountPhoneCheckpoint } from '../scripts/qa/child-account-phone-checkpoints.mjs';

const hash = 'a'.repeat(64), codeHash = 'b'.repeat(64);
const fixture = {childUid: 'child-login', parentUid: 'parent', childId: 'child-profile', clubId: 'club', childInstanceId: 'c'.repeat(64)};
const createdAt = {seconds: 100, nanoseconds: 0}, approvedAt = {seconds: 101, nanoseconds: 0};
function baseline() {
  const identity = {childId: fixture.childId, clubId: fixture.clubId, childInstanceId: fixture.childInstanceId, parentUserId: fixture.parentUid};
  return {documents: {
    users: [{id: fixture.childUid, data: {roles: {child: true}, childInvitationHash: hash}}],
    childAccountInvitationAccounts: [{id: fixture.childUid, data: {...identity, invitationHash: hash}}],
    childAccountInvitations: [{id: hash, data: {...identity, status: 'accepted', accountUserId: fixture.childUid}}],
    childAccountLinks: [], childAccountApprovalOwners: [], childAccountApprovalRequests: [],
  }, claims: [{uid: fixture.childUid, claims: {roleKeys: ['child'], childInvitationHash: hash}}], liveData: null};
}
function state(approved = false) {
  const value = baseline();
  value.documents.childAccountApprovalOwners.push({id: fixture.childUid, data: {accountUserId: fixture.childUid, codeHash, createdAt}});
  value.documents.childAccountApprovalRequests.push({id: codeHash, data: {accountUserId: fixture.childUid,
    invitationHash: hash, createdAt, expiresAt: {seconds: 700, nanoseconds: 0}, status: 'pending'}});
  if (approved) {
    Object.assign(value.documents.childAccountApprovalRequests[0].data, {status: 'approved', approvedAt,
      approvedByUserId: fixture.parentUid, childId: fixture.childId, childInstanceId: fixture.childInstanceId});
    value.documents.childAccountLinks.push({id: fixture.childUid, data: {accountUserId: fixture.childUid,
      childId: fixture.childId, childInstanceId: fixture.childInstanceId, status: 'verified', verifiedAt: approvedAt, verifiedByUserId: fixture.parentUid}});
  }
  return value;
}
test('invitation-created accounts retain the exact binding in all six ordered checkpoints', () => {
  const states = [baseline(), state(), state(), state(true), state(true), state(true)];
  for (const [index, value] of states.entries())
    assert.equal(verifyChildAccountPhoneCheckpoint(childAccountPhonePhases[index], baseline(), value, fixture, states[index - 1]).status, 'passed');
});
test('partial or mismatched invitation identities are never treated as unbound accounts', () => {
  for (const mutate of [value => delete value.documents.users[0].data.childInvitationHash,
    value => delete value.claims[0].claims.childInvitationHash,
    value => value.documents.childAccountInvitationAccounts = [],
    value => value.documents.childAccountInvitations[0].data.status = 'pending',
    value => value.documents.childAccountInvitations[0].data.accountUserId = 'other',
    value => value.documents.childAccountInvitationAccounts[0].data.parentUserId = 'other',
    value => value.documents.childAccountInvitations[0].data.childInstanceId = 'd'.repeat(64)]) {
    const value = baseline(); mutate(value); assert.throws(() => childPhoneInvitationHash(value, fixture));
  }
});
test('a missing, replaced or extra request binding cannot pass', () => {
  for (const mutate of [value => delete value.documents.childAccountApprovalRequests[0].data.invitationHash,
    value => value.documents.childAccountApprovalRequests[0].data.invitationHash = 'e'.repeat(64),
    value => value.documents.childAccountApprovalRequests[0].data.code = 'private-code']) {
    const value = state(); mutate(value);
    assert.throws(() => verifyChildAccountPhoneCheckpoint('code-created', baseline(), value, fixture));
  }
});
test('the observer saves the original observation before validating it', async () => {
  const {readFileSync} = await import('node:fs');
  const source = readFileSync(new URL('../scripts/qa/manual-child-account-phone-session.mjs', import.meta.url), 'utf8');
  const start = source.indexOf('const state = await snapshot();');
  assert(start > 0);
  assert(source.indexOf("phase + '-observed.json'", start) < source.indexOf('const result = verifyChildAccountPhoneCheckpoint(', start));
});

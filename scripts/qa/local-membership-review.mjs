import assert from 'node:assert/strict';
import { FieldValue } from 'firebase-admin/firestore';
import { auth, db, signIn, call, denied, document } from './local-flow-client.mjs';

const clubId = 'sgm-qa-club-green-wavre';
async function account(key, roleKeys = ['parent']) {
  const uid = `sgm-qa-membership-${key}`;
  const email = `${key}@example.test`;
  await auth.createUser({ uid, email, password: process.env.SGM_QA_PASSWORD });
  await auth.setCustomUserClaims(uid, { roleKeys });
  await db.collection('users').doc(uid).set({ displayName: `Membre QA ${key}` });
  return signIn(email);
}
async function row(actor, id) {
  let cursor;
  do {
    const result = await call('listClubMemberships', actor, { clubId, ...(cursor ? { cursor } : {}) });
    const match = result.items.find((item) => item.id === id);
    if (match) return match;
    cursor = result.nextCursor;
  } while (cursor);
  throw new Error('Membership not returned');
}
export async function checkMembershipReview() {
  const manager = await signIn('c@example.test');
  const admin = await account('review-admin', ['admin']);
  const foreignManager = await account('foreign-manager', ['clubManager']);
  const applicant = await account('approve');
  const rejected = await account('reject');
  const before = (await document('clubs', clubId)).memberCount;
  await call('requestClubMembership', foreignManager, { clubId });
  await denied('listClubMemberships', foreignManager, { clubId }, 'PERMISSION_DENIED');
  await denied('listMembershipReviewClubs', applicant, {}, 'PERMISSION_DENIED');
  await denied('listClubMemberships', null, { clubId }, 'UNAUTHENTICATED');
  await denied('listClubMemberships', manager, { clubId: 'foreign-club' }, 'PERMISSION_DENIED');
  const first = await call('requestClubMembership', applicant, { clubId });
  const request = await row(manager, first.membershipId);
  assert.deepEqual(request.allowedActions, ['approve', 'reject']);
  const input = { membershipId: request.id, expectedVersion: request.requestVersion, decision: 'approve' };
  await denied('reviewClubMembership', applicant, input, 'PERMISSION_DENIED');
  await denied('reviewClubMembership', foreignManager, input, 'PERMISSION_DENIED');
  await denied('reviewClubMembership', admin, { ...input, membershipId: 'bad/id' }, 'INVALID_ARGUMENT');
  const race = await Promise.allSettled([call('reviewClubMembership', manager, input), call('reviewClubMembership', admin, input)]);
  assert.equal(race.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal((await document('clubs', clubId)).memberCount, before + 1);
  await denied('reviewClubMembership', manager, input, 'FAILED_PRECONDITION');
  assert.equal((await document('memberships', request.id)).role, 'member');
  assert.deepEqual((await auth.getUser(applicant.uid)).customClaims.roleKeys, ['parent']);
  const second = await call('requestClubMembership', rejected, { clubId });
  const secondRow = await row(admin, second.membershipId);
  const rejectInput = { membershipId: secondRow.id, expectedVersion: secondRow.requestVersion, decision: 'reject' };
  await call('reviewClubMembership', admin, rejectInput);
  assert.equal((await document('clubs', clubId)).memberCount, before + 1);
  assert.equal((await document('memberships', secondRow.id)).active, false);
  await call('requestClubMembership', rejected, { clubId });
  assert.equal((await document('memberships', secondRow.id)).reviewedByUserId, undefined);
  const rerequest = await row(manager, secondRow.id);
  assert.notEqual(rerequest.requestVersion, secondRow.requestVersion);
  await denied('reviewClubMembership', admin, rejectInput, 'FAILED_PRECONDITION');
  const managerRef = db.collection('memberships').doc(`${manager.uid}_${clubId}`);
  await managerRef.update({ active: false });
  await denied('listClubMemberships', manager, { clubId }, 'PERMISSION_DENIED');
  await denied('reviewClubMembership', manager, { ...input, membershipId: rerequest.id, expectedVersion: rerequest.requestVersion }, 'PERMISSION_DENIED');
  await managerRef.update({ active: FieldValue.delete() });
  await call('reviewClubMembership', admin, { ...input, membershipId: rerequest.id, expectedVersion: rerequest.requestVersion });
  assert.equal((await document('clubs', clubId)).memberCount, before + 2);
  for (let i = 0; i < 25; i++) {
    const uid = `sgm-qa-history-${String(i).padStart(2, '0')}`;
    await db.collection('memberships').doc(`${uid}_${clubId}`).set({ userId: uid, clubId, role: 'member', status: 'requested', active: false });
  }
  let cursor; const seen = new Set(); let firstCursor;
  do {
    const result = await call('listClubMemberships', manager, { clubId, ...(cursor ? { cursor } : {}) });
    for (const item of result.items) { assert(!seen.has(item.id)); seen.add(item.id); }
    cursor = result.nextCursor; firstCursor ??= cursor;
  } while (cursor);
  assert([...seen].filter((id) => id.startsWith('sgm-qa-history-')).length === 25);
  await denied('listClubMemberships', admin, { clubId, cursor: firstCursor }, 'PERMISSION_DENIED');
  await denied('listClubMemberships', manager, { clubId, cursor: '!invalid' }, 'INVALID_ARGUMENT');
  for (let i = 0; i < 25; i++) {
    const id = `sgm-qa-managed-${String(i).padStart(2, '0')}`;
    await db.collection('clubs').doc(id).set({ name: `Club QA ${i}`, status: 'public', memberCount: 1 });
    await db.collection('memberships').doc(`${manager.uid}_${id}`).set({ userId: manager.uid, clubId: id, role: 'clubManager', status: 'active' });
  }
  cursor = undefined; const managed = new Set(); let clubCursor;
  do {
    const result = await call('listMembershipReviewClubs', manager, cursor ? { cursor } : {});
    for (const club of result.items) { assert(!managed.has(club.id)); managed.add(club.id); }
    cursor = result.nextCursor; clubCursor ??= cursor;
  } while (cursor);
  assert.equal(managed.size, 26);
  await denied('listMembershipReviewClubs', admin, { cursor: clubCursor }, 'PERMISSION_DENIED');
  const invalid = db.collection('memberships').doc('sgm-qa-broken-count');
  await invalid.set({ userId: applicant.uid, clubId: 'sgm-qa-no-count', role: 'member', status: 'requested', active: false });
  await db.collection('clubs').doc('sgm-qa-no-count').set({ name: 'Club sans compteur QA', status: 'public' });
  await denied('reviewClubMembership', admin, { membershipId: invalid.id, decision: 'approve',
    expectedVersion: `${(await invalid.get()).updateTime.seconds}.${(await invalid.get()).updateTime.nanoseconds}` }, 'FAILED_PRECONDITION');
  assert.equal((await invalid.get()).get('status'), 'requested');
  const audits = await db.collection('membershipReviews').get();
  const notes = await db.collection('notifications').where('type', '==', 'membershipReviewed').get();
  assert.equal(audits.size, 3); assert.equal(notes.size, 3);
  for (const audit of audits.docs) {
    const note = notes.docs.find((item) => item.id === audit.id);
    assert.equal(note?.get('userId'), audit.get('userId'));
    assert.equal(note?.get('sourceId'), audit.get('membershipId'));
  }
  return { concurrentDecisionWinners: 1, approvedCount: 2, rejectedCount: 1, auditCount: 3, notificationCount: 3,
    memberCountBefore: before, memberCountAfter: before + 2, paginatedHistory: 25, paginatedManagedClubs: 26,
    foreignManagerRejected: true, revokedManagerRejected: true, staleRerequestRejected: true, roleEscalation: false, livePush: false };
}

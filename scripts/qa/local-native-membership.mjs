import assert from 'node:assert/strict';
import { auth, db, document } from './local-flow-client.mjs';

export const nativeMembershipClubIds = ['sgm-qa-native-approve', 'sgm-qa-native-reject'];

export async function seedNativeMembershipClubs() {
  for (const [index, clubId] of nativeMembershipClubIds.entries()) {
    assert(!(await db.collection('clubs').doc(clubId).get()).exists, 'Native membership fixture must be new');
    await db.collection('clubs').doc(clubId).set({ name: ['Club adhésion QA', 'Club nouvelle demande QA'][index],
      sport: 'Football', status: 'public', memberCount: 1, createdAt: new Date() });
    await db.collection('memberships').doc(`sgm-qa-club-manager_${clubId}`).set({
      userId: 'sgm-qa-club-manager', clubId, role: 'clubManager', status: 'active', active: true, createdAt: new Date() });
    assert(!(await db.collection('memberships').doc(`sgm-qa-parent_${clubId}`).get()).exists);
  }
}

export async function verifyNativeMembershipUi() {
  const records = [];
  const reviews = await db.collection('membershipReviews').where('userId', '==', 'sgm-qa-parent').get();
  assert.equal(reviews.size, 3, 'Two approvals and one refusal must be audited');
  const notifications = await db.collection('notifications').where('userId', '==', 'sgm-qa-parent')
    .where('type', '==', 'membershipReviewed').get();
  assert.equal(notifications.size, 3);
  for (const [index, clubId] of nativeMembershipClubIds.entries()) {
    const membershipId = `sgm-qa-parent_${clubId}`;
    const membership = await document('memberships', membershipId);
    assert.equal(membership.userId, 'sgm-qa-parent'); assert.equal(membership.clubId, clubId);
    assert.equal(membership.role, 'member'); assert.equal(membership.status, 'active'); assert.equal(membership.active, true);
    assert.equal(membership.reviewedByUserId, 'sgm-qa-club-manager');
    assert(membership.reviewedAt.toDate());
    const audit = reviews.docs.filter((review) => review.get('membershipId') === membershipId);
    assert.equal(audit.length, index === 0 ? 1 : 2);
    assert.equal(audit.filter((review) => review.get('decision') === 'approve').length, 1);
    assert.equal(audit.filter((review) => review.get('decision') === 'reject').length, index);
    for (const review of audit) {
      assert.equal(review.get('reviewerUserId'), 'sgm-qa-club-manager');
      const notification = notifications.docs.find((item) => item.id === review.id);
      assert.equal(notification?.get('sourceId'), membershipId);
    }
    const memberCount = (await document('clubs', clubId)).memberCount;
    assert.equal(memberCount, 2, 'Only the approval increments the counter');
    records.push({ clubId, status: membership.status, active: membership.active, memberCount, reviewCount: audit.length });
  }
  const user = await auth.getUser('sgm-qa-parent');
  assert.deepEqual(user.customClaims.roleKeys, ['parent']);
  return { method: 'app-request-refresh-ui-with-local-sdk-manager-decisions-and-persisted-checks',
    records, reviewCount: reviews.size, notificationCount: notifications.size, roleEscalation: false,
    livePush: false, limitation: 'Manager decisions use authenticated local SDK calls, not a mobile management UI.' };
}

import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { isAbsolute } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const [sessionPath, output, phase = 'complete'] = process.argv.slice(2);
assert(isAbsolute(sessionPath) && isAbsolute(output) && !existsSync(output), 'Fresh absolute evidence paths are required');
assert(['pending', 'complete'].includes(phase));
const session = JSON.parse(readFileSync(sessionPath, 'utf8'));
assert.equal(session.projectId, 'demo-sgm-local-qa');
process.env.SGM_QA_PASSWORD = session.password;
const { db, document } = await import('./local-flow-client.mjs');
const clubId = 'sgm-qa-club-green-wavre';
const records = [];
for (const [key, status, actor] of [
  ['approve', 'active', 'sgm-qa-club-manager'], ['reject', 'rejected', 'sgm-qa-club-manager'], ['admin', 'active', 'sgm-qa-admin'],
]) {
  const userId = `sgm-qa-applicant-${key}`;
  const id = `${userId}_${clubId}`;
  const data = await document('memberships', id);
  assert.equal(data.status, phase === 'pending' ? 'requested' : status);
  assert.equal(data.active, phase === 'complete' && status === 'active');
  assert.equal(data.role, 'member');
  assert.equal(data.reviewedByUserId, phase === 'pending' ? undefined : actor);
  if (phase === 'complete') assert(data.reviewedAt?.toDate());
  records.push({ membershipId: id, userId, status: data.status, active: data.active, reviewer: data.reviewedByUserId ?? null });
}
const reviews = await db.collection('membershipReviews').get();
const notifications = await db.collection('notifications').where('type', '==', 'membershipReviewed').get();
assert.equal(reviews.size, phase === 'pending' ? 0 : 3);
assert.equal(notifications.size, reviews.size);
for (const record of records) {
  if (phase === 'pending') continue;
  const audit = reviews.docs.filter((item) => item.get('membershipId') === record.membershipId);
  assert.equal(audit.length, 1);
  assert.equal(audit[0].get('reviewerUserId'), record.reviewer);
  assert.equal(audit[0].get('status'), record.status);
  const notification = notifications.docs.find((item) => item.id === audit[0].id);
  assert.equal(notification?.get('userId'), record.userId);
}
const memberCount = (await document('clubs', clubId)).memberCount;
assert.equal(memberCount, phase === 'pending' ? 3 : 5);
if (phase === 'complete') {
  const responsive = await document('memberships', `sgm-qa-applicant-responsive_${clubId}`);
  assert.equal(responsive.status, 'requested');
  assert.equal(responsive.active, false);
  assert.equal(responsive.reviewedByUserId, undefined);
}
const sources = ['admin/src/App.tsx', 'admin/src/ClubDashboard.tsx', 'admin/src/MembershipReviewPanel.tsx',
  'admin/src/MembershipReviewController.ts', 'admin/src/MembershipConfirmation.tsx', 'admin/src/membershipReviewGateway.ts',
  'admin/src/useAdminAuth.ts', 'admin/src/memberships.css', 'admin/src/ClubOperationsTables.tsx', 'admin/src/membershipReviewTypes.ts',
  'functions/src/callables/memberships.ts', 'functions/src/lib/membershipPageCursor.ts', 'functions/src/callables/membershipReview.ts',
  'functions/src/callables/membershipLists.ts', 'functions/src/lib/membershipReviewAccess.ts', 'functions/src/domain/membershipReview.ts', 'firestore.rules'];
const fingerprints = Object.fromEntries(sources.map((path) => [path, createHash('sha256').update(readFileSync(path)).digest('hex')]));
const result = { projectId: session.projectId, runId: session.runId, testedAt: new Date().toISOString(), phase,
  scope: 'local-management-persisted-state-not-ui-proof', method: 'read-only-independent-record-checks',
  sourceBase: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), sourceState: 'working-tree-before-commit',
  fingerprints, records, reviewCount: reviews.size, notificationCount: notifications.size, memberCount, livePush: false,
  responsiveConfirmationStillPending: phase === 'complete',
  limits: ['Persisted records alone do not prove how the UI action was performed.', 'No production data, mobile membership screen or push delivery tested.'] };
writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`, { flag: 'wx' });
console.log(`Membership persisted-state check passed (${phase}).`);

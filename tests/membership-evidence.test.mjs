import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { content, captures } from '../partner-portal/content.mjs';

const root = new URL('../', import.meta.url);
const base = 'docs/release/evidence/local-membership-review-2026-10-16/';
const read = (file) => readFileSync(new URL(base + file, root), 'utf8');
const json = (file) => JSON.parse(read(file));
test('membership claims retain the actual sixteen-group service run', () => {
  const run = json('services.json');
  assert.equal(run.projectId, 'demo-sgm-local-qa');
  assert.equal(run.scope, 'local-emulated-services-not-phone-ui');
  assert.equal(run.steps.length, 16);
  assert(run.steps.every((step) => step.status === 'passed'));
  assert.deepEqual(run.membershipReview, {
    concurrentDecisionWinners: 1, approvedCount: 2, rejectedCount: 1, auditCount: 3, notificationCount: 3,
    memberCountBefore: 3, memberCountAfter: 5, paginatedHistory: 25, paginatedManagedClubs: 26,
    foreignManagerRejected: true, revokedManagerRejected: true, staleRerequestRejected: true, roleEscalation: false, livePush: false,
  });
});
test('manual UI evidence is distinguished from persisted-state and phone evidence', () => {
  const ui = json('ui-results.json'), persisted = json('persisted.json'), dismissed = json('dismissed.json');
  assert.equal(ui.method, 'manual-browser-ui-with-independent-persisted-checks');
  assert.equal(ui.scope, 'local-ui-not-physical-device');
  assert.equal(persisted.scope, 'local-management-persisted-state-not-ui-proof');
  assert.equal(ui.runId, persisted.runId); assert.equal(ui.runId, dismissed.runId);
  assert(ui.steps.every((step) => step.status === 'passed'));
  assert.equal(persisted.records.length, 3);
  assert.deepEqual(persisted.records.map((record) => record.status), ['active', 'rejected', 'active']);
  assert.deepEqual(persisted.records.map((record) => record.reviewer), ['sgm-qa-club-manager', 'sgm-qa-club-manager', 'sgm-qa-admin']);
  assert.equal(persisted.reviewCount, 3); assert.equal(persisted.notificationCount, 3); assert.equal(persisted.memberCount, 5);
  assert.equal(persisted.livePush, false); assert.equal(persisted.responsiveConfirmationStillPending, true);
  assert.equal(dismissed.reviewCount, 0); assert.equal(dismissed.memberCount, 3);
  assert(dismissed.records.every((record) => record.status === 'requested' && record.reviewer === null));
  assert(Object.values(persisted.fingerprints).every((hash) => /^[a-f0-9]{64}$/.test(hash)));
  assert.equal(ui.observations.horizontalOverflow, false);
  const flow = content.flows.find((item) => item.id === 'clubs');
  assert.equal(flow.status, 'partial'); assert.equal(flow.checkedAt, ui.testedAt.slice(0, 10));
  assert.match(flow.remaining, /enfant/); assert.match(flow.remaining, /téléphone/);
  assert(!content.blockers.some((item) => item.id === 'membership-review'));
  assert(flow.images.slice(0, 2).every((image) => image.landscape === true));
  assert.match(readFileSync(new URL('partner-portal/src/styles.css', root), 'utf8'), /\.media-stage\.is-landscape/);
  assert.match(read('README.md'), /have not been deployed/);
});
test('reviewed images and raw unit/rules evidence remain scoped', () => {
  for (const name of ['manager-decisions.jpg', 'admin-decisions.jpg', 'mobile-confirmation.jpg']) {
    const bytes = readFileSync(new URL(base + name, root));
    assert.equal(bytes.readUInt16BE(0), 0xffd8); assert.equal(bytes.readUInt16BE(bytes.length - 2), 0xffd9);
    assert(bytes.length > 1000);
    assert(Object.values(captures).includes(base + name));
  }
  assert.equal((read('controller-passed.xml').match(/<testcase\b/g) || []).length, 9);
  assert(!/<failure\b|<error\b/.test(read('controller-passed.xml')));
  assert.match(read('domain-passed.xml'), /tests="4" failures="0" errors="0"/);
  assert.match(read('native-state-passed.xml'), /tests="3" skipped="0" failures="0" errors="0"/);
  assert.match(read('rules-passed.xml'), /tests="16" failures="0" errors="0"/);
  assert(existsSync(new URL(base + 'parent-denied.jpg', root)));
  assert(!Object.values(captures).includes(base + 'parent-denied.jpg'));
});

import assert from 'node:assert/strict';

export const teamReviewServiceChecks = Object.freeze([
  'team-review-requires-auth-and-current-exact-club-management',
  'twenty-five-teams-paginate-with-immutable-identity-and-minimal-fields',
  'team-review-cursors-cannot-cross-clubs-or-enrollment-lists',
  'manager-revocation-invalidates-an-already-returned-team-cursor',
  'closed-team-removal-remains-discoverable-without-parent-enrollment-access',
  'team-review-reads-never-create-or-rewrite-any-protected-record',
  'persisted-core-decisions-and-all-twenty-three-other-requests-retain-exact-actors-and-revisions',
  'scoped-fixture-cleanup-restores-all-original-records-and-account-roles',
]);
export const teamReviewBrowserChecks = Object.freeze([
  'manager-sign-in-team-choice-and-request-pagination',
  'responsive-real-requests-desktop-tablet-mobile-and-large-text',
  'cancelled-approval-does-not-write', 'manager-refusal-and-parent-new-request',
  'lost-approval-reply-clears-actions-and-reconciles-without-resubmitting',
  'parent-withdrawal-is-visible-and-cannot-be-decided-again',
  'verified-child-approval-is-confirmed-in-the-manager-screen',
  'guardian-loss-redacts-child-and-manager-can-remove-the-enrollment',
  'manager-access-loss-clears-private-rows-and-team-choices',
  'sign-out-and-parent-account-cannot-retain-manager-screen',
]);
export const teamReviewCaptures = Object.freeze(['team-review-requests-1440.png', 'team-review-requests-768.png',
  'team-review-requests-390.png', 'team-review-requests-320.png', 'team-review-large-text-320.png',
  'team-review-confirmation-320.png', 'team-review-approval-recovered-320.png', 'team-review-child-approved-320.png',
  'team-review-child-revoked-320.png', 'team-review-access-revoked-320.png']);

export function validateTeamReviewReport(run, requireBrowser = true) {
  assert.equal(run.scope, 'local-team-manager-review-not-physical-or-parent-native-ui');
  assert.equal(run.projectId, 'demo-sgm-local-qa'); assert.match(run.runId, /^[a-f0-9]{32}$/);
  assert(Number.isFinite(Date.parse(run.testedAt)));
  assert.equal(run.testCount, 8); assert.deepEqual(run.checks, teamReviewServiceChecks.map((id) => ({ id, status: 'passed' })));
  for (const field of ['independentPersistedVerification', 'fixtureCleanupVerified']) assert.equal(run[field], true);
  for (const field of ['productionWrites', 'physicalDevice', 'parentNativeUiProven', 'wholeNativeReplayProven',
    'fullProcessRestartProven', 'videoCaptured', 'releaseEvidenceAccepted', 'teamChatImplemented']) assert.equal(run[field], false);
  assert.equal(run.providerRequests, 0); assert.equal(run.teamRequestsThroughAuthenticatedSdk, 26);
  assert.equal(run.coreEnrollmentTransitions, 8); assert.equal(run.otherRequestsUnchanged, 23); assert.equal(run.guardianTransitions, 3);
  assert.equal(run.parentRequestsMethod, 'authenticated-local-sdk-not-parent-ui');
  if (!requireBrowser && !run.browser) {
    assert.equal(run.managerUiProven, false); assert.equal(run.managerDecisionsMethod, 'authenticated-local-sdk');
    assert.deepEqual(run.steps, [{ id: 'team-review-services', status: 'passed' }]); return;
  }
  assert.equal(run.managerUiProven, true); assert.equal(run.managerDecisionsMethod, 'authenticated-management-browser');
  assert.deepEqual(run.steps, [{ id: 'team-review-services', status: 'passed' }, { id: 'team-manager-review-ui', status: 'passed' }]);
  const browser = run.browser;
  assert.equal(browser.scope, 'local-manager-browser-with-actual-emulated-services-not-native-or-physical');
  assert.equal(browser.externalRequests, 0); assert.equal(browser.productionWrites, false);
  assert.deepEqual(browser.checks, teamReviewBrowserChecks.map((id) => ({ id, status: 'passed' })));
  assert.deepEqual(browser.screenshots, teamReviewCaptures); assert.deepEqual(browser.viewports, [1440, 768, 390, 320]);
  assert.equal(browser.largeTextScale, 1.3); assert(Number.isFinite(Date.parse(browser.checkedAt)));
  assert(Date.parse(browser.checkedAt) <= Date.parse(run.testedAt));
}

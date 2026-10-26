import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { assertRetainedSourceFiles } from './retained-source-evidence.mjs';

export const invitationBrowserFolder = 'docs/release/evidence/child-invitation-browser-2026-10-26/';
export function validateConnectedInvitationReport(report) {
  assert.equal(report.scope, 'isolated-connected-browser-signup-not-native-share-or-phone-approval');
  assert.equal(report.projectId, 'demo-sgm-local-qa');
  assert.match(report.applicationHead, /^[a-f0-9]{40}$/); assert.match(report.runId, /^[a-f0-9]{32}$/);
  for (const key of ['nativeUiExecuted', 'physicalDevice', 'productionWrites']) assert.equal(report[key], false, key);
  assert.equal(report.providerRequests, 0); assert.equal(report.parentApprovalSeparate, true);
  assert.equal(report.accountCreatedThroughBrowser, true);
  assert.equal(report.observations.length, 3);
  for (const [index, phase] of ['before', 'mismatch', 'created'].entries()) {
    const row = report.observations[index];
    assert.equal(row.phase, phase); assert(Number.isFinite(Date.parse(row.checkedAt)));
    assert.equal(row.userCount, index === 2 ? 4 : 3);
    assert.equal(row.invitationStatus, index === 2 ? 'accepted' : 'pending');
    assert.equal(row.redemptionRequests, index === 2 ? 1 : 0);
    assert.equal(row.parentApprovalCount, 0); assert.equal(row.originalRolesUnchanged, true);
    if (index) assert(Date.parse(row.checkedAt) >= Date.parse(report.observations[index - 1].checkedAt));
  }
  assert.equal(report.verifiedAt, report.observations[2].checkedAt);
}
export function validateInvitationBrowserReview(review) {
  assert.equal(review.scope, 'manual-browser-review-with-real-local-gateway-not-phone-proof');
  assert.equal(review.browserTabId, '1621934900');
  assert.equal(review.component, 'admin/src/ChildInvitationPage.tsx');
  assert.equal(review.submitHandlerInjected, false); assert.equal(review.accountFormSubmittedInIframe, false);
  assert.equal(review.mobileFrameWidth, 390); assert.equal(review.desktopViewportWidth, 1440);
  assert.deepEqual(review.observedStates, ['Créer mon compte enfant', 'Les mots de passe ne correspondent pas.',
    'Création…', 'Compte créé', 'Invitation indisponible']);
  assert.equal(review.parentApprovalReminderVisible, true); assert.equal(review.secretAbsentFromFinalAddress, true);
  for (const key of ['phoneTested', 'nativeShareChooserOpened', 'appLinkOpened', 'newGalleryMediaAccepted', 'applicationDeployed', 'releaseAccepted'])
    assert.equal(review[key], false, key);
}
export function validateChildInvitationBrowserEvidence(root) {
  const read = path => readFileSync(resolve(root, invitationBrowserFolder, path));
  const report = JSON.parse(read('observations.json')); validateConnectedInvitationReport(report);
  assertRetainedSourceFiles(root, report.sourceFiles);
  for (const file of ['admin/src/main.tsx', 'admin/src/ChildInvitationPage.tsx', 'admin/src/childInvitationGateway.ts',
    'scripts/qa/child-invitation-browser-runtime.mjs', 'scripts/qa/start-child-invitation-browser.mjs']) assert(report.sourceFiles[file]);
  validateInvitationBrowserReview(JSON.parse(read('browser-review.json')));
  const disposal = JSON.parse(read('disposal.json'));
  assert.equal(disposal.runId, report.runId); assert.equal(disposal.projectId, report.projectId);
  assert.equal(disposal.scope, 'owned-runtime-disposal-not-browser-proof'); assert.equal(disposal.failed, false);
  assert.equal(disposal.processGroupExited, true); assert.equal(disposal.isolatedEnvironmentDestroyed, true);
  assert.deepEqual(disposal.emulatorEndpoints, { host: '127.0.0.1', ports: [9099, 8080, 9000, 5001, 4185], closed: true });
  assert(Date.parse(disposal.closedAt) > Date.parse(report.verifiedAt));
  const hashes = JSON.parse(read('artifact-sha256.json'));
  assert.deepEqual(Object.keys(hashes).sort(), ['README.md', 'browser-review.json', 'observations.json', 'disposal.json'].sort());
  for (const [path, hash] of Object.entries(hashes)) assert.equal(createHash('sha256').update(read(path)).digest('hex'), hash, path);
}

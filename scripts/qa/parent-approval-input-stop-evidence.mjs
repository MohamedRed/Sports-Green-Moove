import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import jpeg from 'jpeg-js';
import {assertEvidenceBundleChecksums} from './evidence-bundle-checksums.mjs';
import {assertRetainedSourceFiles} from './retained-source-evidence.mjs';

export const parentApprovalInputStopFolder = 'docs/release/evidence/parent-approval-input-stop-2026-11-02/';
export function assertParentApprovalInputStop(incident) {
  assert.equal(incident.scope, 'stopped-temporary-local-credential-input-not-an-application-or-parent-approval-result');
  assert.equal(incident.sourceCommit, '5d34c0f1fac1ba39571c4b420e0c4b81129de5d8');
  assert.equal(incident.runId, '4a8797842602ef33d7aea11559f60a28');
  assert.equal(incident.wrongDestinationObserved, 'phone-browser-address-bar');
  assert.equal(incident.sensitiveInputKind, 'temporary-local-fixture-password');
  assert.equal(incident.externalAutocompleteTransmission, 'possible-not-independently-measured');
  assert.equal(incident.sensitiveToolOutputOccurred, true);
  assert.equal(incident.temporaryCredentialInvalidatedByDatasetDisposal, true);
  for (const key of ['sensitiveFrameRetainedInRepository', 'sensitiveValueRetainedInReport', 'realCredentialAffected',
    'exactRoutingCauseProven', 'unsafeCredentialReused', 'childAccountCreated', 'parentApprovalProven',
    'correctedPhoneRetryExecuted', 'releaseComplete']) assert.equal(incident[key], false, key);
}
export function validateParentApprovalInputStop(root) {
  const folder = resolve(root, parentApprovalInputStopFolder), read = file => JSON.parse(readFileSync(resolve(folder, file)));
  assertEvidenceBundleChecksums(folder); const incident = read('incident.json'); assertParentApprovalInputStop(incident);
  const observations = read('observations.json'), records = read('connection-blocked-records.json'), disposal = read('disposal.json');
  for (const row of [observations, records, disposal]) {
    assert.equal(row.projectId, 'demo-sgm-local-qa'); assert.equal(row.runId, incident.runId);
  }
  assert.equal(observations.applicationHead, incident.sourceCommit);
  assert.deepEqual(observations.observations.map(row => row.phase), ['before', 'mismatch']);
  for (const row of observations.observations) {
    assert.equal(row.userCount, 3); assert.equal(row.invitationStatus, 'pending');
    assert.equal(row.redemptionRequests, 0); assert.equal(row.parentApprovalCount, 0); assert.equal(row.originalRolesUnchanged, true);
  }
  assert.equal(records.accountCount, 3); assert.equal(records.invitationStatus, 'pending');
  for (const key of ['redemptionCount', 'approvalRequestCount', 'accountLinkCount']) assert.equal(records[key], 0);
  for (const key of ['childAccountExists', 'signupProven', 'parentApprovalProven', 'productionWrites', 'releaseComplete']) assert.equal(records[key], false);
  assert.equal(records.adminClientClosed, true); assert.equal(records.firestoreClientTerminated, true);
  assert.equal(disposal.failed, false);
  for (const key of ['processGroupExited', 'isolatedEnvironmentDestroyed', 'privatePhoneSessionAbsent', 'privateSignupInputAbsent'])
    assert.equal(disposal[key], true, key);
  assert.deepEqual(disposal.emulatorEndpoints, {host: '127.0.0.1', ports: [9099, 8080, 9000, 5001, 4185], closed: true});
  const cleanup = read('phone-and-helper-disposal.json');
  for (const key of ['sessionStopped', 'uninstallAcknowledged', 'helperGroupExitVerified', 'helperDirectoryAbsent',
    'privateInputsAbsent', 'hostClipboardRestored', 'privatePasswordCleared']) assert.equal(cleanup[key], true);
  for (const key of ['independentPackageAbsenceProven', 'devicePolicyChanged', 'hostPermissionsChanged']) assert.equal(cleanup[key], false);
  assert.equal(cleanup.helperExitCode, 130); assert.equal(cleanup.endpoints.closed, true);
  assert.match(readFileSync(resolve(folder, 'uninstall-observation.txt'), 'utf8'), /Succesfully uninstalled your app\(s\)!/);
  const masked = jpeg.decode(readFileSync(resolve(folder, 'masked-mismatch-session.jpg')), {formatAsRGBA: true});
  assert.equal(masked.width, 1440); assert.equal(masked.height, 722);
  assertRetainedSourceFiles(root, observations.sourceFiles); assertRetainedSourceFiles(root, read('source-files.json'));
  return {signupProven: false, parentApprovalProven: false, credentialInvalidated: true, releaseComplete: false};
}

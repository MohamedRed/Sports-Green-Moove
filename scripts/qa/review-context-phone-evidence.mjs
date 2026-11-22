import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {imageSize} from 'image-size';
import {assertEvidenceBundleChecksums} from './evidence-bundle-checksums.mjs';
import {assertRetainedSourceFiles} from './retained-source-evidence.mjs';

export const contextPhoneEvidenceFolder = 'docs/release/evidence/review-context-phone-attempt-2026-10-29/';
export function assertContextPhoneAttempt(summary, phone) {
  assert.equal(summary.scope, 'partial-physical-android-contextual-review-not-completed-replay');
  assert.equal(summary.sourceCommit, '74e8bd8c01b18c6e47c58b6e5c4afc2d4238e302');
  for (const key of ['physicalDeviceTested', 'driverTripContextObserved', 'driverFiveStarSubmissionObserved',
    'rootInventoryFailureReproduced', 'scopedInventoryRegressionPassed']) assert.equal(summary[key], true, key);
  for (const key of ['twoAccountReplayCompleted', 'parentContextUiVerified', 'legacyContextUiVerified', 'reconnectionVerified',
    'processRestartProven', 'realNetworkLossVerified', 'installedBytesIndependentlyVerified', 'fullCurrentNativeGatePassed',
    'releaseComplete', 'productionWrites', 'realPayments', 'credentialRotationPerformed']) assert.equal(summary[key], false, key);
  assert.equal(summary.mapRequests, 0); assert.equal(summary.independentCheckpoints, 2); assert.equal(summary.plannedCheckpoints, 8);
  assert.equal(summary.finalRootCases, 2737);
  assert.equal(phone.projectId, 'demo-sgm-local-qa'); assert.equal(phone.completed, false);
  assert.equal(phone.phoneUiProvenByThisObserver, false); assert.equal(phone.installedBytesIndependentlyVerified, false);
  assert.equal(phone.sourceApkSha256, '87572997804d63c9a633d8d5d670c288e7a6fa14c8187bca3018b41c63b8834c');
  assert.equal(phone.fixtureSubmittedInitialRatings, 31); assert.equal(phone.subsequentRatingsFixtureSubmitted, false);
  assert.equal(phone.adminClientClosed, true); assert.equal(phone.firestoreClientTerminated, true);
  assert.equal(phone.productionWrites, false); assert.equal(phone.providerRequests, 0);
  assert.deepEqual(phone.checks.map(row => row.phase), ['driver-context', 'driver-rated']);
  for (const [index, row] of phone.checks.entries()) {
    assert.equal(row.status, 'passed'); assert.equal(row.runId, phone.runId);
    assert.equal(row.driverRequests, 1 - index); assert.equal(row.parentRequests, 32); assert.equal(row.ratingCount, 31 + index);
    assert.equal(row.unavailableParentRequests, 1); assert.equal(row.parentFirstPageSize, 20);
    assert.equal(row.exactReviewTargetsPreserved, true); assert.equal(row.originalRecordsAndClaimsPreserved, true);
    assert.equal(row.protectedRecordCount, 158); assert.equal(row.phoneUiProvenByThisObserver, false); assert.equal(row.processRestartProven, false);
  }
  const {closedPorts, independentRemotePackageAbsenceVerified, ...observed} = summary.disposal;
  assert.equal(independentRemotePackageAbsenceVerified, false);
  assert.deepEqual(closedPorts, [5001, 8080, 9000, 9099, 45690, 45691]);
  assert.deepEqual(Object.keys(observed).sort(), ['providerUninstallConfirmationObserved', 'providerIdleDashboardObserved',
    'ownedBackendStopped', 'ownedHelperStopped', 'privateHandoffDirectoriesRemoved', 'runtimeDirectoryRemoved',
    'privateSessionFileRemoved', 'hostClipboardRestored'].sort());
  assert(Object.values(observed).every(value => value === true));
  return summary;
}
export function validateContextPhoneAttempt(root, reference = {source: contextPhoneEvidenceFolder + 'summary.json'}) {
  assert.equal(reference.source, contextPhoneEvidenceFolder + 'summary.json');
  const base = resolve(root, contextPhoneEvidenceFolder), json = file => JSON.parse(readFileSync(resolve(base, file + '.json')));
  assertEvidenceBundleChecksums(base);
  const phone = json('phone/session-results'), summary = assertContextPhoneAttempt(json('summary'), phone);
  assertRetainedSourceFiles(root, phone.sourceFiles);
  for (const row of phone.checks) assert.deepEqual(json('phone/' + row.phase), row);
  for (const name of ['driver-context', 'driver-rated']) {
    const size = imageSize(readFileSync(resolve(base, 'captures/' + name + '.jpg')));
    assert.equal(size.type, 'jpg'); assert(size.width >= 278 && size.height >= 620);
  }
  const text = file => readFileSync(resolve(base, file + '.txt'), 'utf8');
  assert.match(text('rotation-retention-before'), /spawnSync git ENOBUFS/);
  assert.match(text('rotation-retention-after'), /# pass 8\b/);
  assert.match(text('current-web-job'), /spawnSync git ENOBUFS/);
  assert.match(text('targeted-contracts'), /# pass 27\b/);
  assert.match(text('root-tests-port-conflict'), /EADDRINUSE/); assert.match(text('root-tests-port-conflict'), /# fail 5\b/);
  assert.match(text('root-tests-after-disposal'), /# pass 2721\b/); assert.match(text('root-tests-after-disposal'), /# fail 0\b/);
  assert.match(text('root-tests-before-gallery-update'), /# fail 3\b/);
  assert.match(text('root-tests-final'), /# pass 2737\b/); assert.match(text('root-tests-final'), /# fail 0\b/);
  assert.match(text('team-conversation-original'), /Failed to connect to \/10\.0\.2\.2:9099/);
  return summary;
}

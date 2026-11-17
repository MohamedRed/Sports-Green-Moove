import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {imageSize} from 'image-size';
import {assertEvidenceBundleChecksums} from './evidence-bundle-checksums.mjs';
import {assertRetainedSourceFiles} from './retained-source-evidence.mjs';
import {contextPhonePhases} from './review-context-phone-checkpoints.mjs';
import {assertContextProcessRecovery} from './review-context-replay-process.mjs';
import {assertContextReplayGate, contextReplayHead} from './review-context-replay-gate.mjs';

export const contextReplayFolder = 'docs/release/evidence/review-context-phone-replay-2026-10-29/';
export function assertContextReplayPhone(summary, phone, review, disposal) {
  assert.equal(summary.scope, 'physical-android-contextual-reviews-with-auth-and-process-recovery-not-release');
  assert.equal(summary.sourceCommit, contextReplayHead); assert.equal(summary.phoneCheckpoints, 8);
  assert.equal(phone.completed, true); assert.equal(phone.projectId, 'demo-sgm-local-qa');
  assert.equal(phone.fixtureSubmittedInitialRatings, 31); assert.equal(phone.subsequentRatingsFixtureSubmitted, false);
  assert.equal(phone.adminClientClosed, true); assert.equal(phone.firestoreClientTerminated, true);
  assert.equal(phone.productionWrites, false); assert.equal(phone.providerRequests, 0);
  assert.equal(phone.phoneUiProvenByThisObserver, false); assert.equal(phone.installedBytesIndependentlyVerified, false);
  assert.equal(phone.sourceApkSha256, '87572997804d63c9a633d8d5d670c288e7a6fa14c8187bca3018b41c63b8834c');
  assert.deepEqual(phone.checks.map(row => row.phase), contextPhonePhases);
  for (const [index, row] of phone.checks.entries()) {
    assert.equal(row.runId, phone.runId); assert.equal(row.status, 'passed');
    assert.equal(row.driverRequests, index > 0 ? 0 : 1); assert.equal(row.parentRequests, index >= 5 ? 31 : 32);
    assert.equal(row.ratingCount, 31 + Number(index > 0) + Number(index >= 5));
    assert.equal(row.unavailableParentRequests, 1); assert.equal(row.parentFirstPageSize, 20);
    assert.equal(row.protectedRecordCount, 158); assert.equal(row.originalRecordsAndClaimsPreserved, true);
    assert.equal(row.exactReviewTargetsPreserved, true); assert.equal(row.phoneUiProvenByThisObserver, false);
    assert.equal(row.processRestartProven, false);
  }
  for (const key of ['physicalPhoneUiReviewed', 'sameNamedTripsDistinguished', 'explicitLegacyDetailsObserved',
    'driverReconnectedWithoutPrompt', 'parentReconnected', 'parentRestartedWithSession', 'parentSummaryObserved',
    'finalSignOutObserved', 'remoteClipboardReplaced', 'hostClipboardRestored', 'providerUninstallObserved', 'providerIdleObserved'])
    assert.equal(review[key], true, key);
  assert.deepEqual(review.parentSummary, {displayedMean: '4,0 / 5', count: 32, fixtureRatings: 31, phoneRatings: 1});
  for (const key of ['realNetworkLossVerified', 'iosUiExecuted', 'installedBytesIndependentlyVerified', 'realPayments',
    'productionWrites', 'releaseComplete', 'earlierInputRootCauseConfirmed']) assert.equal(summary[key], false, key);
  assert.equal(summary.mapRequests, 0);
  assert.deepEqual(disposal.ports, [5001, 8080, 9000, 9099, 45690, 45691].map(port => ({port, closed: true})));
  for (const key of ['runtimeDirectoryRemoved', 'privateHandoffRemoved', 'privateSessionFileRemoved']) assert.equal(disposal[key], true, key);
  return summary;
}
export function validateContextReplayEvidence(root, reference = {source: contextReplayFolder + 'summary.json'}) {
  assert.equal(reference.source, contextReplayFolder + 'summary.json');
  const base = resolve(root, contextReplayFolder), json = file => JSON.parse(readFileSync(resolve(base, file + '.json')));
  assertEvidenceBundleChecksums(base);
  const phone = json('phone/session-results'), summary = assertContextReplayPhone(json('summary'), phone, json('ui-review'), json('disposal'));
  assertRetainedSourceFiles(root, phone.sourceFiles);
  assertRetainedSourceFiles(root, json('source-sha256'));
  for (const row of phone.checks) assert.deepEqual(json('phone/' + row.phase), row);
  const snapshots = Object.fromEntries(['before', 'stopped', 'reopened'].map(phase =>
    [phase, readFileSync(resolve(base, 'process/' + phase + '-ax.txt'), 'utf8')]));
  assertContextProcessRecovery(json('process/before'), json('process/stopped'), json('process/reopened'), json('process/package-removed'), phone.runId, snapshots);
  assert.deepEqual(json('application-source-comparison'), {apkSourceCommit: '74e8bd8c01b18c6e47c58b6e5c4afc2d4238e302',
    testedSourceCommit: contextReplayHead, changedApplicationFiles: []});
  assert.deepEqual(summary.gate, assertContextReplayGate(base));
  const captures = readdirSync(resolve(base, 'captures')); assert.equal(captures.length, 20);
  for (const file of captures) {const size = imageSize(readFileSync(resolve(base, 'captures', file)));
    assert.equal(size.type, 'jpg'); assert(size.width >= 339 && size.height >= 40);}
  const prior = JSON.parse(readFileSync(resolve(root, 'docs/release/evidence/review-context-phone-attempt-2026-10-29/phone/session-results.json')));
  assert.equal(prior.completed, false); assert.equal(prior.checks.length, 2); assert.notEqual(prior.runId, phone.runId);
  return summary;
}

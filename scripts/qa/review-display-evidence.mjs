import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {imageSize} from 'image-size';
import {assertEvidenceBundleChecksums} from './evidence-bundle-checksums.mjs';
import {assertRetainedSourceFiles} from './retained-source-evidence.mjs';

export const reviewDisplayFolder = 'docs/release/evidence/review-display-recovery-2026-10-29/';
export function assertReviewDisplayEvidence({summary, ordinary, units, restoration, proxy, disposal, installed}) {
  assert.equal(summary.scope, 'local-review-component-and-controlled-session-recovery-not-release');
  assert.equal(summary.baselineCommit, '0b008ece43a485c2d27bb59df73c7b366990e5cf');
  assert.equal(summary.implementationWasUncommittedAtBuild, true);
  assert.equal(summary.failedAssertionWasFalsePositive, true);
  assert.equal(summary.averageClippingDefectProven, false);
  assert.equal(summary.componentCasesPassed, 6); assert.equal(summary.componentCasesFailed, 0);
  assert.equal(summary.originalCaptureSha256, 'f061c489d0b2b8438c34ce362c4f379d97e07b2fdfcc4bfa2cde93dd711d99af');
  for (const key of ['physicalDeviceTested', 'realNetworkLossVerified', 'fullNativeGatePassed', 'productionDeployed',
    'productionWrites', 'releaseComplete', 'realPayments', 'iosUiExecuted']) assert.equal(summary[key], false, key);
  assert.equal(summary.mapRequests, 0); assert.equal(summary.syntheticMaximumCount, true);
  assert.deepEqual([ordinary.caseCount, ordinary.passed, ordinary.skipped, ordinary.failed], [244, 189, 54, 1]);
  assert.equal(ordinary.cases.filter(row => row.status === 'failed').length, 1);
  assert.equal(ordinary.cases.find(row => row.status === 'failed').name, 'maximumCountFitsNarrowWidthAndLargeFontsWithoutCoveringRefresh');
  assert.deepEqual(units, {tests: 633, failures: 0, errors: 0, skipped: 0});
  assert.equal(restoration.scope, 'local-session-restoration-ui-not-physical-network-loss');
  for (const key of ['completed', 'nativeUiExecuted', 'initialFailureVisible', 'failureSurvivedRotation',
    'explicitRetryRecoveredSameParent', 'healthyRotationRestoredSameParent', 'profileIdentityVerified', 'parentSignedOut',
    'proxyClosed', 'adminClientClosed', 'firestoreClientTerminated', 'localPackagesRemoved', 'isolatedEnvironmentDestroyed'])
    assert.equal(restoration[key], true, key);
  for (const key of ['physicalDevice', 'realNetworkLossVerified', 'productionWrites', 'safetyAuditAccepted', 'storeReviewAccepted'])
    assert.equal(restoration[key], false, key);
  assert.equal(restoration.testCount, 1); assert.equal(restoration.restorationAttempts, 4);
  assert.deepEqual(restoration.steps, [{id: 'session-restoration', status: 'passed'}]);
  for (const key of ['allTopLevelCollectionsUnchangedExceptParentTimestamp', 'allUserClaimsUnchanged', 'liveTripsUnchanged'])
    assert.equal(restoration.fixtureIsolation[key], true, key);
  assert.equal(proxy.runId, restoration.runId); assert.equal(proxy.failed, undefined);
  assert.deepEqual(proxy.attempts.filter(row => row.method === 'initializeUserProfile').map(row => row.downstreamStatus), [503, 503, 200, 200]);
  const reads = proxy.attempts.filter(row => row.method === 'getReceivedRatingSummary');
  assert.deepEqual(reads, [{phase: 'recover', method: 'getReceivedRatingSummary', uid: 'sgm-qa-parent', upstreamStatus: 200, downstreamStatus: 200}]);
  for (const key of ['ownedEmulatorProcessesAbsent', 'ownedAdbProcessAbsent', 'noLocalRuntimeDirectories']) assert.equal(disposal[key], true, key);
  assert.deepEqual(disposal.ports, [5001, 8080, 9000, 9099, 45690, 45691, 5582, 5584, 5037].map(port => ({port, available: true})));
  assert.equal(installed.serial, 'emulator-5582'); assert.equal(installed.records.length, 2);
  assert.deepEqual(installed.records.map(row => row.packageName), ['be.sportgreenmoove.app.local', 'be.sportgreenmoove.app.local.test']);
  for (const record of installed.records) {assert.equal(record.installedBytesVerified, true); assert.match(record.sha256, /^[a-f0-9]{64}$/);}
  return summary;
}
export function validateReviewDisplayEvidence(root, reference = {source: reviewDisplayFolder + 'summary.json'}) {
  assert.equal(reference.source, reviewDisplayFolder + 'summary.json');
  const base = resolve(root, reviewDisplayFolder), json = file => JSON.parse(readFileSync(resolve(base, file + '.json')));
  const text = file => readFileSync(resolve(base, file), 'utf8');
  assertEvidenceBundleChecksums(base);
  const summary = assertReviewDisplayEvidence({summary: json('summary'), ordinary: json('prior-ordinary-results'),
    units: json('android-unit-counts'), restoration: json('recovery/session-restoration-results'),
    proxy: json('recovery/session-restoration-proxy'), disposal: json('disposal'), installed: json('installed-apks')});
  for (const file of ['native-sources', 'original-sources']) assertRetainedSourceFiles(root, json(file));
  const recovery = json('recovery/session-restoration-results'); assertRetainedSourceFiles(root, recovery.sourceFiles);
  assert.match(text('before-instrumentation.txt'), /Tests run: 1,\s+Failures: 1/);
  assert.match(text('after-instrumentation-first.txt'), /Tests run: 6,\s+Failures: 1/);
  assert.match(text('after-instrumentation-first.txt'), /4,9 \/ 5/);
  assert.match(text('after-line-bounds.txt'), /OK \(6 tests\)/);
  assert.match(text('layout-line-bounds-logcat.txt'), /tag=value size=197 x 87 paragraph=471\.0x87\.0/);
  assert.match(text('layout-line-bounds-logcat.txt'), /lineRight=\[197\.0\] lineBottom=\[87\.0\]/);
  assert.match(text('before-proxy-test.log'), /# fail 1/); assert.match(text('after-proxy-tests.log'), /# pass 13/);
  assert.match(text('after-proxy-tests.log'), /# fail 0/);
  assert.match(text('after-build.log'), /BUILD SUCCESSFUL/);
  assert.match(text('recovery/LocalSessionRestorationTest-instrumentation.txt'), /OK \(1 test\)/);
  const digest = bytes => createHash('sha256').update(bytes).digest('hex');
  assert.equal(digest(readFileSync(resolve(base, 'recovery/LocalSessionRestorationTest-instrumentation.txt'))), recovery.transcriptSha256);
  const capture = readFileSync(resolve(base, 'received-ratings-large-text.png'));
  assert.equal(digest(capture), summary.originalCaptureSha256);
  assert.deepEqual(imageSize(capture), {height: 349, width: 735, type: 'png'});
  for (const [file, sha256] of Object.entries(recovery.screenshots)) assert.equal(digest(readFileSync(resolve(base, 'recovery', file))), sha256, file);
  const transfer = json('recovery/adb-pull-session-restoration'); assert.equal(transfer.completed, true); assert.equal(transfer.status, 0);
  return summary;
}

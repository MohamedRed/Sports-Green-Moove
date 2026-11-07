import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {assertEvidenceBundleChecksums} from './evidence-bundle-checksums.mjs';
import {assertRetainedSourceFiles} from './retained-source-evidence.mjs';
import {assertInstrumentationPassed} from './android-instrumentation-result.mjs';
import {parseAndroidJUnitTranscript} from './android-junit-transcript.mjs';
import {validateRejectedCaptureCi} from './rejected-capture-ci-evidence.mjs';

export const rejectedCaptureFolder = 'docs/release/evidence/rejected-capture-probe-2026-10-30/';
export function validateRejectedCaptureProbe(root, reference = {source: rejectedCaptureFolder + 'summary.json', checkedAt: '2026-10-30',
  checksums: rejectedCaptureFolder + 'artifact-sha256.json'}) {
  assert.deepEqual(reference, {source: rejectedCaptureFolder + 'summary.json', checkedAt: '2026-10-30', checksums: rejectedCaptureFolder + 'artifact-sha256.json'});
  const base = resolve(root, rejectedCaptureFolder), read = file => readFileSync(resolve(base, file));
  const json = file => JSON.parse(read(file)), sha = bytes => createHash('sha256').update(bytes).digest('hex');
  assertEvidenceBundleChecksums(base); const summary = json('summary.json');
  validateRejectedCaptureCi(base);
  assert.equal(summary.scope, 'local-rejected-capture-probe-not-root-cause-or-release-acceptance');
  assert.equal(summary.checkedAt, '2026-10-30'); assert.equal(summary.sourceBase, '1cc8f12e19db286491f1ec6dfff76be0ba836946');
  assert.deepEqual([summary.baselineComponentCases, summary.candidateComponentCases, summary.diagnosticCalibrationCases], [3, 3, 4]);
  assert.equal(summary.startupFailureBeforeCases, true);
  for (const key of ['primaryApiModified', 'primaryDeadlineModified', 'outerRetryAdded', 'alternateImageAccepted', 'rootCauseProven',
    'realCiRejectionReproduced', 'releaseAccepted', 'newMediaAccepted', 'physicalDevice', 'productionWrites']) assert.equal(summary[key], false, key);
  const baseline = json('baseline/results.json'), failed = json('failed/results.json'), fresh = json('fresh/results.json');
  assert.equal(baseline.scope, 'local-team-chat-components-with-fake-gateway-not-connected-or-physical');
  assert.equal(baseline.componentCaseCount, 3); assert.equal(baseline.connectedBackend, false); assert.equal(baseline.physicalDevice, false);
  assert.equal(baseline.steps.length, 3); assert(baseline.steps.every(row => row.status === 'passed'));
  assertInstrumentationPassed(read('baseline/instrumentation.txt').toString(), 3);
  for (const [file, expected] of Object.entries(baseline.screenshots)) assert.equal(sha(read('baseline/' + file)), expected, file);
  assert.equal(Object.keys(baseline.screenshots).length, 8);
  assert.equal(sha(read('baseline/original-device-setup.json')), baseline.apkPreparation.receiptSha256);
  assert.deepEqual(json('baseline/original-device-setup.json'), json('baseline/device-setup.json'));
  for (const [name, run] of [['failed', failed], ['fresh', fresh]]) {
    assert.equal(run.scope, 'rejected-bitmap-calibration-and-team-components-not-ci-root-cause-proof');
    for (const key of ['backendConnected', 'physicalDevice', 'rootCauseProven', 'realCiRejectionReproduced', 'productionWrites', 'newMediaAccepted'])
      assert.equal(run[key], false, key);
    assert.equal(run.deviceRestorationVerified, true);
    assert.equal(sha(read(name + '/device-setup.json')), run.apkPreparation.receiptSha256);
    const copy = json(name + '/rejected-primary-copy.json'); assert.deepEqual(run.diagnosticCollection, copy);
    assert.equal(copy.collectionStatus, 'not-observed'); assert.equal(copy.validatedPairCount, 0);
    assert.equal(copy.imageAccepted, false); assert.equal(copy.replacementCaptureUsed, false);
  }
  assert.equal(failed.completed, false); assert.equal(failed.report, null);
  assert.match(read('failed/instrumentation.txt').toString(), /shortMsg=Process crashed\./);
  assert.match(read('failed/evidence-copy-team-chat-components-process-log.txt').toString(), /failed to complete startup/);
  assert.equal(json('failed/adb-pull-team-chat-components.json').completed, false);
  assert.equal(fresh.completed, true); assert.deepEqual(fresh.failureCategories, []);
  const parsed = parseAndroidJUnitTranscript(read('fresh/instrumentation.txt').toString());
  assert.deepEqual(parsed, fresh.report); assert.deepEqual([parsed.caseCount, parsed.passed, parsed.skipped, parsed.failed], [7, 7, 0, 0]);
  for (const [name, count] of [['RejectedPrimaryBitmapTest', 4], ['TeamConversationFlowTest', 3]])
    assert.equal(parsed.cases.filter(row => row.className === 'be.sportgreenmoove.app.ui.' + name).length, count);
  assert.deepEqual(failed.sourceFiles, fresh.sourceFiles); assert.deepEqual(failed.apkPreparation.apkHashes, fresh.apkPreparation.apkHashes);
  assert.notEqual(json('failed/device-setup.json').serial, json('fresh/device-setup.json').serial);
  for (const stem of ['narrow', 'denied', 'unconfirmed', 'confirmed']) {
    const marker = json('fresh/team-chat-' + stem + '.json');
    assert.equal(marker.completed, true); assert.equal(marker.scope, 'local-team-chat-component-with-fake-gateway-not-connected-or-physical');
    assert.equal(sha(read('fresh/team-chat-' + stem + '.png')), marker.imageSha256);
    assert.equal(sha(read('fresh/team-chat-' + stem + '-window.png')), marker.windowSha256);
  }
  for (const [name, run] of [['baseline', baseline], ['failed', failed], ['fresh', fresh]]) {
    assertRetainedSourceFiles(root, run.sourceFiles);
    const restore = json(name + '/device-restored.json'); assert.equal(restore.verified, true); assert.equal(restore.restored, true);
    assert.equal(restore.observed.continuousGuardVerified, true);
    for (const key of ['localPackagesRemoved', 'background', 'stopped', 'launcher']) assert.equal(restore.restoration[key], true, key);
    for (const key of ['authorizationRemoved', 'componentRemoved', 'originalPolicyRestored']) assert.equal(restore.restoration.installAdmin[key], true, key);
  }
  const copy = json('fresh/adb-pull-team-chat-components.json'); assert.equal(copy.completed, true); assert.equal(copy.status, 0);
  assert.equal(copy.runId, fresh.runId); assert.equal(copy.errorCode, null); assert.equal(copy.signal, null);
  return summary;
}

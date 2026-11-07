import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseAndroidJUnitTranscript } from './android-junit-transcript.mjs';
import { assertRetainedSourceFiles } from './retained-source-evidence.mjs';
import { validatePrimaryCaptureDiagnostic } from './primary-capture-diagnostic-schema.mjs';

export const captureWindowFolder = 'docs/release/evidence/capture-window-calibration-2026-10-30/';
export function assertCaptureWindowSummary(summary) {
  assert.equal(summary.baseHead, '1f421382eea1417cacbd2dca267386f16dad86b3');
  assert.equal(summary.scope, 'controlled-observer-window-calibration-not-renderer-or-release-repair');
  assert.equal(summary.controlledGapReproduced, true); assert.equal(summary.controlledCalibrationPassed, true);
  for (const key of ['rootCauseProven', 'realCiFailureReproduced', 'fullGateAccepted', 'physicalDeviceAccepted', 'newPublicMediaAccepted'])
    assert.equal(summary[key], false);
}
export function validateCaptureWindowEvidence(root) {
  const base = resolve(root, captureWindowFolder);
  const bytes = file => readFileSync(resolve(base, file));
  const json = file => JSON.parse(bytes(file));
  const hashes = json('artifact-sha256.json');
  for (const [file, hash] of Object.entries(hashes)) {
    assert.match(file, /^[\w.-]+(?:\/[\w.-]+)*$/); assert(!file.split('/').includes('..'));
    assert.equal(createHash('sha256').update(bytes(file)).digest('hex'), hash, file);
  }
  const summary = json('summary.json');
  const sdk = bytes('sdk-window-capture-1.10.6.txt').toString();
  assert.match(sdk, /lconst_1[\s\S]*TimeUnit\.SECONDS[\s\S]*CountDownLatch\.await/);
  assert.match(sdk, /Failed waiting for PixelCopy!/);
  assert.match(bytes('sdk-resolution.txt').toString(), /androidx\.compose\.ui:ui-test-android:1\.10\.6/);
  for (const mode of ['baseline', 'candidate']) assert.match(bytes(`${mode}-build.txt`).toString(), /BUILD SUCCESSFUL/);
  assertCaptureWindowSummary(summary);
  const runs = {};
  for (const [mode, failed, version] of [['baseline', 2, 3], ['candidate', 0, 4]]) {
    const result = json(`${mode}/results.json`); runs[mode] = result;
    assert.equal(result.mode, mode); assert.equal(result.completed, true);
    assert.equal(result.allTestsPassed, failed === 0); assert.equal(result.deviceRestorationVerified, true);
    const report = parseAndroidJUnitTranscript(bytes(`${mode}/instrumentation.txt`).toString());
    assert.deepEqual(result.report, report); assert.equal(report.caseCount, 8);
    assert.equal(report.failed, failed); assert.equal(report.skipped, 0);
    const calibration = report.cases.filter(row => row.className.endsWith('.PrimaryCaptureWindowCalibrationTest'));
    assert.equal(calibration.length, 2);
    assert(calibration.every(row => row.status === (failed ? 'failed' : 'passed')));
    assert.equal(report.cases.find(row => row.name === 'largeTextParentSeesBothVersionsAndAcceptsWithoutApplying').status, 'passed');
    assert.equal(report.cases.filter(row => row.className.endsWith('.PrimaryCaptureDiagnosticsTest')).length, 5);
    assertRetainedSourceFiles(root, result.sourceFiles);
    for (const key of ['realCiFailureReproduced', 'rootCauseProven', 'backendConnected', 'physicalDevice', 'productionWrites', 'fullGateAccepted', 'newPublicMediaAccepted'])
      assert.equal(result[key], false);
    const restored = json(`${mode}/device-restored.json`);
    assert.equal(restored.restored, true); assert.equal(restored.verified, true);
    for (const key of ['localPackagesRemoved', 'background', 'stopped', 'launcher']) assert.equal(restored.restoration[key], true);
    for (const key of ['authorizationRemoved', 'componentRemoved', 'originalPolicyRestored']) assert.equal(restored.restoration.installAdmin[key], true);
    const setup = json(`${mode}/device-setup.json`);
    assert.equal(setup.case, 'trip-change-components'); assert.match(setup.serial, /^emulator-\d+$/);
    assert.deepEqual(setup.apkHashes, result.apkPreparation.apkHashes);
    assert.deepEqual(Object.keys(setup.apkHashes).sort(), ['be.sportgreenmoove.app', 'be.sportgreenmoove.app.test']);
    const copy = json(`${mode}/primary-copy.json`);
    assert.equal(copy.status, 0); assert.equal(copy.signal, null); assert.equal(copy.errorCode, null);
    const images = json(`${mode}/primary-files.json`);
    const names = ['trip-change-parent-review-large-text', 'trip-change-parent-accepted'].flatMap(name => [name + '.png', name + '-window.png']);
    assert.deepEqual(Object.keys(images).sort(), names.sort());
    for (const [name, image] of Object.entries(images)) {
      const raw = bytes(`${mode}/images/${name}`);
      assert.equal(createHash('sha256').update(raw).digest('hex'), image.sha256);
      assert.equal(raw.subarray(1, 4).toString(), 'PNG'); assert(image.width < image.height);
    }
    const collection = json(`${mode}/capture-timing/collection.json`);
    assert.equal(collection.ok, true); assert.equal(collection.ordinaryPassed, false);
    assert.equal(collection.traces.length, 2); assert.equal(collection.copyStatus, 0);
    assert.deepEqual(result.diagnostic, collection);
    for (const file of Object.keys(collection.files)) {
      const value = json(`${mode}/capture-timing/${file}`);
      assert.equal(validatePrimaryCaptureDiagnostic(value).complete, true);
      assert.equal(value.schemaVersion, version); assert.equal(value.primaryOutcome, 'returned');
      assert.equal(value.sdkInvocations, 1);
    }
  }
  const setup = mode => json(`${mode}/device-setup.json`);
  assert.notEqual(setup('baseline').serial, setup('candidate').serial);
  const source = (run, name) => readFileSync(resolve(root, 'docs/release/evidence/source-archive',
    run.sourceFiles['android/app/src/androidTest/java/be/sportgreenmoove/app/ui/' + name] + '.txt'), 'utf8');
  assert.equal(source(runs.baseline, 'PrimaryCaptureWindowCalibrationTest.kt'), source(runs.candidate, 'PrimaryCaptureWindowCalibrationTest.kt'));
  assert.equal(source(runs.baseline, 'LocalUiCapture.kt'), source(runs.candidate, 'LocalUiCapture.kt'));
  assert.equal(source(runs.baseline, 'TripChangeFlowTest.kt'), source(runs.candidate, 'TripChangeFlowTest.kt'));
  assert.equal(source(runs.baseline, 'PrimaryCaptureProbe.kt').replace('1_200L', '750L').replace('.put("schemaVersion", 3)', '.put("schemaVersion", 4)'),
    source(runs.candidate, 'PrimaryCaptureProbe.kt'));
  const closure = json('device-session-closure.json');
  assert.equal(closure.selectedSerialsAbsent, true); assert.equal(closure.ownedProcessesAbsent, true);
  assert.deepEqual(closure.selectedSerials, [setup('baseline').serial, setup('candidate').serial]);
  const ci = json('previous-ci/native-run.json');
  assert.equal(ci.headSha, summary.baseHead);
  assert.equal(ci.status, 'completed'); assert.equal(ci.conclusion, 'failure');
  const job = ci.jobs.find(row => row.databaseId === 124102901617);
  assert.equal(job.name, 'Android focused safety UI tests / Isolated remote-ride-stop');
  assert.equal(job.status, 'completed'); assert.equal(job.conclusion, 'failure');
  const artifact = json('previous-ci/artifact.json');
  assert.equal(artifact.id, 12983067931); assert.equal(artifact.workflow_run.head_sha, summary.baseHead);
  assert.equal(artifact.digest, 'sha256:5c26dda00a4e95125527700c375ca075c077303ea6b2be799388479efcacb01b');
  assert.match(bytes('previous-ci/LocalRemoteRideStopFlowTest-instrumentation.txt').toString(), /OK \(1 test\)/);
  const failedCopy = json('previous-ci/adb-pull-remote-ride-stop.json');
  assert.equal(failedCopy.status, 1); assert.equal(failedCopy.completed, false);
  assert.equal(json('previous-ci/remote-ride-stop-suite-status.json').status, 1);
  assert.equal(json('previous-ci/disposable-device-restore.json').verified, true);
  const storage = json('previous-ci/adb-sync-remote-ride-stop-diagnostics.json').observations.find(row => row.id === 'storage-service-log');
  assert.equal(storage.collected, true); assert.match(storage.value, /connection terminated: write failed/);
  return { baselineCalibrationFailures: 2, candidatePassedCases: 8, rootCauseProven: false, fullGateAccepted: false };
}

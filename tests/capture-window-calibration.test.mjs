import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { validatePrimaryCaptureDiagnostic, captureDiagnosticScope, requiredTripCaptureNames } from '../scripts/qa/primary-capture-diagnostic-schema.mjs';
import { assertCaptureWindowSummary, captureWindowFolder, validateCaptureWindowEvidence } from '../scripts/qa/capture-window-evidence.mjs';
import { content } from '../partner-portal/content.mjs';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const sample = offsetMs => ({ offsetMs, scheduledMs: offsetMs + 1, atMs: offsetMs + 2, observerDelayMs: 1,
  mainState: 'TIMED_WAITING', mainFrames: [], callerFrames: [] });
const current = () => ({ schemaVersion: 4, scope: captureDiagnosticScope, captureName: requiredTripCaptureNames[1],
  sampleScheduleMs: [250, 750, 1600], sdkInvocations: 1, primaryOutcome: 'threw', errorCategory: 'pixelcopy-callback-wait',
  elapsedMs: 1070, primaryStartOffsetMs: 1, primaryElapsedMs: 1069, callerIsMain: false, mainPostAccepted: true,
  heartbeatDelaysMs: [0], heartbeatAtMs: [54], maxMainQueueDelayMs: 0, samples: [250, 750].map(sample),
  sampleFailures: 0, observerClosed: true, observerTerminationVerified: true,
  observerMayAffectScheduling: true, imagesWrittenByObserver: false });

test('version four covers a one-second operation without losing the optional later window', () => {
  const value = current();
  assert.equal(validatePrimaryCaptureDiagnostic(value).complete, true);
  assert.equal(value.primaryOutcome, 'threw'); assert.equal(value.sdkInvocations, 1);
  const longer = { ...value, elapsedMs: 1751, primaryElapsedMs: 1750, samples: [250, 750, 1600].map(sample) };
  assert.equal(validatePrimaryCaptureDiagnostic(longer).complete, true);
});
for (const [name, mutate] of [
  ['the old middle offset', value => value.samples[1] = sample(1200)],
  ['the old schedule under a new version', value => value.sampleScheduleMs = [250, 1200, 1600]],
  ['a new offset under the old version', value => { value.schemaVersion = 3; value.sampleScheduleMs = [250, 1200, 1600]; }],
  ['another operation', value => value.sdkInvocations = 2],
  ['a fourth sample', value => value.samples.push(sample(1600), sample(250))],
  ['a new unrecognised version', value => value.schemaVersion = 5],
]) test(`capture-window protocol refuses ${name}`, () => {
  const value = current(); mutate(value); assert.throws(() => validatePrimaryCaptureDiagnostic(value));
});
test('the original missed-window observation remains version three and cannot become a later observation', () => {
  const before = JSON.parse(read('docs/release/evidence/test-runner-security-2026-10-30/base-native/parent-capture-diagnostic.json'));
  assert.equal(validatePrimaryCaptureDiagnostic(before).complete, true);
  assert.equal(before.schemaVersion, 3); assert.deepEqual(before.samples.map(row => row.offsetMs), [250]);
  assert(before.sampleScheduleMs.slice(1).every(offset => offset > before.elapsedMs));
  assert.equal(before.primaryOutcome, 'threw');
});
test('controlled native calibration remains cache-only and never stands in for an SDK screenshot', () => {
  const source = read('android/app/src/androidTest/java/be/sportgreenmoove/app/ui/PrimaryCaptureWindowCalibrationTest.kt');
  assert(source.includes('File(context.cacheDir, "capture-window-calibration-'));
  assert(source.includes('directory.deleteRecursively()')); assert(source.includes('observeControlledOperation(1_100)'));
  assert(source.includes('observeControlledOperation(1_750)')); assert(source.includes('CountDownLatch::class.java.name'));
  assert(source.includes('released.countDown()')); assert(source.includes('handler.removeCallbacks(block)'));
  assert(!/captureToImage|PixelCopy\.request|takeScreenshot/.test(source));
  const runner = read('scripts/qa/run-capture-window-probe.mjs');
  assert(runner.includes("mode === 'baseline' ? 2 : 0"));
  assert(runner.includes("assert.equal(report.caseCount, 8)"));
  assert(runner.includes('restoreContinuousDevice(device, setup)'));
  assert(runner.includes('assertContinuousDevice(device, setup)'));
  assert(runner.includes('realCiFailureReproduced: false')); assert(runner.includes('fullGateAccepted: false'));
});
test('retained native before and after trials keep failures, exact source and independent restoration', () => {
  assert.deepEqual(validateCaptureWindowEvidence(new URL('..', import.meta.url).pathname), {
    baselineCalibrationFailures: 2, candidatePassedCases: 8, rootCauseProven: false, fullGateAccepted: false,
  });
  const update = content.updates.find(row => row.source === captureWindowFolder + 'README.md');
  assert.equal(update.flow, 'publication'); assert.match(update.text, /deux essais locaux/);
  assert.equal(content.flows.find(row => row.id === 'publication').status, 'partial');
});
for (const flag of ['rootCauseProven', 'realCiFailureReproduced', 'fullGateAccepted', 'physicalDeviceAccepted', 'newPublicMediaAccepted']) {
  test(`calibration evidence cannot assert ${flag}`, () => {
    const summary = JSON.parse(read(captureWindowFolder + 'summary.json'));
    summary[flag] = true; assert.throws(() => assertCaptureWindowSummary(summary));
  });
}

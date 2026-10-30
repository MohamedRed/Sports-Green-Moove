import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {parse} from 'yaml';
import {fileURLToPath} from 'node:url';
import {validatePrimaryCaptureDiagnostic, captureDiagnosticScope, requiredTripCaptureNames} from '../scripts/qa/primary-capture-diagnostic-schema.mjs';
import {validateCaptureLateSampling} from '../scripts/qa/capture-late-sampling-evidence.mjs';

test('retained early observations cannot pretend to observe the later failure or repair it', () => {
  const result = validateCaptureLateSampling(fileURLToPath(new URL('..', import.meta.url)));
  assert.equal(result.lateWaitObserved, false); assert.equal(result.newScheduleRuntimeExecuted, false);
});

const sample = offsetMs => ({offsetMs, scheduledMs: offsetMs + 3, atMs: offsetMs + 5, observerDelayMs: 2,
  mainState: 'RUNNABLE', mainFrames: [], callerFrames: []});
const record = () => ({schemaVersion: 3, scope: captureDiagnosticScope, captureName: requiredTripCaptureNames[4],
  sampleScheduleMs: [250, 1200, 1600], sdkInvocations: 1, primaryOutcome: 'threw', errorCategory: 'pixelcopy-callback-wait',
  elapsedMs: 1940, primaryStartOffsetMs: 3, primaryElapsedMs: 1937, callerIsMain: false, mainPostAccepted: true,
  heartbeatDelaysMs: [0, 4], heartbeatAtMs: [54, 104], maxMainQueueDelayMs: 4,
  samples: [250, 1200, 1600].map(sample), sampleFailures: 0, observerClosed: true,
  observerTerminationVerified: true, observerMayAffectScheduling: true, imagesWrittenByObserver: false});

test('version three admits bounded late observations without turning the original failure into success', () => {
  const value = record(); assert.equal(validatePrimaryCaptureDiagnostic(value).complete, true);
  assert.equal(value.primaryOutcome, 'threw'); assert.equal(value.sdkInvocations, 1);
  const quick = {...value, samples: [], elapsedMs: 130, primaryElapsedMs: 127, primaryOutcome: 'returned', errorCategory: 'none'};
  assert.equal(validatePrimaryCaptureDiagnostic(quick).complete, true);
});
test('the schedule is versioned; historical records cannot be reinterpreted as late observations', () => {
  const value = record(); delete value.sampleScheduleMs;
  for (const schemaVersion of [1, 2]) {
    const old = {...value, schemaVersion, samples: [250, 600, 900].map(sample)};
    if (schemaVersion === 1) delete old.observerTerminationVerified;
    assert.equal(validatePrimaryCaptureDiagnostic(old).complete, true);
    assert.throws(() => validatePrimaryCaptureDiagnostic({...old, samples: [sample(1200)]}));
  }
});
for (const [name, change] of [
  ['an unversioned late record', value => {value.schemaVersion = 2;}],
  ['an invented schedule', value => {value.sampleScheduleMs = [250, 600, 900];}],
  ['an old early sample in a new record', value => {value.samples[1] = sample(600);}],
  ['a fourth sample', value => {value.samples.push(sample(1600));}],
  ['a duplicate offset', value => {value.samples[1] = sample(250);}],
  ['unproven observer termination', value => {value.observerTerminationVerified = null;}],
  ['a future unrecognised version', value => {value.schemaVersion = 4;}],
]) test('rejects ' + name, () => {const value = record(); change(value); assert.throws(() => validatePrimaryCaptureDiagnostic(value));});

test('the probe changes sample times only, retaining one call and the existing shutdown bound', () => {
  const source = readFileSync(new URL('../android/app/src/androidTest/java/be/sportgreenmoove/app/ui/PrimaryCaptureProbe.kt', import.meta.url), 'utf8');
  assert(source.includes('for (at in primaryCaptureSampleOffsetsMs)'));
  assert(source.includes('.put("schemaVersion", 3)')); assert(source.includes('.put("sampleScheduleMs", JSONArray(primaryCaptureSampleOffsetsMs))'));
  assert(source.includes('samples.size < 3')); assert(source.includes('executor.awaitTermination(100, TimeUnit.MILLISECONDS)'));
  assert(!/captureToImage|PixelCopy.request|Thread.sleep/.test(source));
});
test('both CI workflows trigger on and execute the late-sample protocol test', () => {
  for (const file of ['native-ci.yml', 'web-integration-smoke.yml']) {
    const source = readFileSync(new URL('../.github/workflows/' + file, import.meta.url), 'utf8');
    assert.equal(source.split('"tests/primary-capture-late-samples.test.mjs"').length - 1, 2);
    const jobs = Object.values(parse(source).jobs);
    assert(jobs.some(job => job.steps?.some(step => step.run?.includes('node --test') && step.run.includes('tests/primary-capture-late-samples.test.mjs'))));
  }
});

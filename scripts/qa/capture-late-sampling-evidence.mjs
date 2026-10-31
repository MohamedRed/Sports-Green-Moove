import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {assertEvidenceBundleChecksums} from './evidence-bundle-checksums.mjs';
import {assertRetainedSourceFiles} from './retained-source-evidence.mjs';
import {validatePrimaryCaptureDiagnostic} from './primary-capture-diagnostic-schema.mjs';

export const captureLateFolder = 'docs/release/evidence/capture-late-sampling-2026-10-30/';
export function validateCaptureLateSampling(root) {
  const base = resolve(root, captureLateFolder), json = file => JSON.parse(readFileSync(resolve(base, file + '.json')));
  assertEvidenceBundleChecksums(base);
  const report = json('analysis'), run = json('run'), ordinary = json('ordinary-results'), suites = json('native-suite-status');
  assert.equal(report.scope, 'failed-primary-capture-observation-not-repair-or-release');
  assert.equal(run.headSha, '60814d709d167e4a0ed93eca22506f8560660e9a'); assert.equal(run.conclusion, 'failure');
  assert.equal(report.sourceCommit, run.headSha); assert.equal(report.runId, run.databaseId);
  assert.deepEqual([ordinary.caseCount, ordinary.passed, ordinary.skipped, ordinary.failed], [252, 197, 54, 1]);
  assert.equal(ordinary.cases.filter(row => row.status === 'failed')[0].name, 'refusalKeepsTheInitialTripWithoutCancellingTheBooking');
  assert.deepEqual([suites.ordinaryTests, suites.componentEvidence, suites.localReplay], [1, 0, 0]);
  const traces = readdirSync(resolve(base, 'original-diagnostics')).map(file => json('original-diagnostics/' + file.replace(/\.json$/, '')));
  assert.equal(traces.length, 6);
  for (const trace of traces) {assert.equal(trace.schemaVersion, 2); assert.equal(validatePrimaryCaptureDiagnostic(trace).complete, true);}
  const failed = traces.filter(trace => trace.primaryOutcome === 'threw'); assert.equal(failed.length, 1);
  assert.equal(report.failedCapture, failed[0].captureName); assert.equal(failed[0].errorCategory, 'pixelcopy-callback-wait');
  assert.equal(report.primaryElapsedMs, failed[0].primaryElapsedMs); assert.equal(report.maxMainQueueDelayMs, failed[0].maxMainQueueDelayMs);
  assert.deepEqual(report.observedOffsetsMs, [250, 600, 900]);
  assert.deepEqual(failed[0].samples.map(row => row.offsetMs), report.observedOffsetsMs);
  assert(failed[0].samples.every(row => row.callerFrames.some(frame => frame.methodName === 'forceRedraw')));
  assert.equal(report.allCallerSamplesInRedraw, true);
  for (const key of ['lateWaitObserved', 'rootCauseProven', 'primaryApiModified', 'primaryDeadlineModified', 'outerRetryAdded',
    'alternateCaptureAdded', 'releaseAccepted', 'newScheduleRuntimeExecuted']) assert.equal(report[key], false, key);
  assert.equal(report.nextSchemaVersion, 3); assert.deepEqual(report.nextSampleScheduleMs, [250, 1200, 1600]);
  const build = json('build-summary'); assert.equal(build.buildPassed, true); assert.equal(build.newScheduleRuntimeExecuted, false);
  assertRetainedSourceFiles(root, build.sourceFiles);
  return report;
}

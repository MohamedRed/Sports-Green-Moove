import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { requiredTripCaptureNames, validatePrimaryCaptureDiagnostic } from './primary-capture-diagnostic-schema.mjs';
import { assertRetainedSourceFiles } from './retained-source-evidence.mjs';

export const captureRuntimeFolder = 'docs/release/evidence/capture-callback-runtime-2026-10-26/';
export function validateCaptureRuntimeReport(report) {
  assert.equal(report.scope, 'passing-instrumented-ci-not-failure-reproduction-or-root-cause-proof');
  assert.equal(report.head, 'f06c61df32127a317684bbeba6924ddbdfbf1acd');
  assert.equal(report.nativeRunId, 40335351161);
  assert.equal(report.contractCasesExecuted, 4);
  assert.equal(report.runtimeTimingCollected, true);
  for (const key of ['failureReproduced', 'rootCauseProven', 'primaryApiModified', 'primaryDeadlineModified',
    'outerRetryAdded', 'alternateCaptureAdded', 'physicalDevice', 'newScreenshotsAccepted', 'releaseAccepted'])
    assert.equal(report[key], false, key);
}

export function validateCaptureRuntimeEvidence(root) {
  const read = path => readFileSync(resolve(root, captureRuntimeFolder, path));
  const report = JSON.parse(read('analysis.json')); validateCaptureRuntimeReport(report);
  assertRetainedSourceFiles(root, report.sourceFiles);
  const ordinary = JSON.parse(read('ordinary-results.json')), suite = JSON.parse(read('native-suite-status.json'));
  assert.deepEqual([ordinary.caseCount, ordinary.passed, ordinary.skipped, ordinary.failed], [228, 174, 54, 0]);
  for (const key of ['complete', 'guardConfirmed', 'installationsRemainedBlocked']) assert.equal(ordinary[key], true);
  assert.equal(ordinary.productionWritesAccepted, false); assert.equal(ordinary.physicalDeviceAccepted, false);
  assert.equal(ordinary.cases.length, 228);
  for (const [status, count] of [['passed', 174], ['skipped', 54]])
    assert.equal(ordinary.cases.filter(row => row.status === status).length, count);
  const contracts = ordinary.cases.filter(row => row.className === 'be.sportgreenmoove.app.ui.PrimaryCaptureDiagnosticsTest');
  assert.equal(contracts.length, 4); assert(contracts.every(row => row.status === 'passed'));
  for (const key of ['ordinaryTests', 'componentEvidence', 'localReplay']) assert.equal(suite[key], 0);
  const pr = JSON.parse(read('pr.json'));
  assert.equal(pr.headRefOid, report.head); assert.equal(pr.statusCheckRollup.length, 25);
  assert(pr.statusCheckRollup.every(row => row.status === 'COMPLETED'));
  assert.equal(pr.statusCheckRollup.filter(row => row.conclusion === 'SUCCESS').length, 20);
  assert.deepEqual(pr.statusCheckRollup.filter(row => row.conclusion === 'SKIPPED').map(row => row.name).sort(),
    ['Android approved real-map UI integration', 'Android approved vehicle-map UI', 'Android approved parent search and booking',
      'iOS native checks', 'iOS native UI tests'].sort());
  assert(pr.statusCheckRollup.some(row => row.name === 'Android native UI tests' && row.conclusion === 'SUCCESS' &&
    row.detailsUrl.endsWith('/40335351161/job/121615319155')));
  const collection = JSON.parse(read('collection.json'));
  assert.equal(collection.scope, 'capture-observation-collection-not-flow-or-root-cause-proof');
  assert.equal(collection.ok, true); assert.equal(collection.ordinaryPassed, true); assert.equal(collection.copyStatus, 0);
  assert.equal(collection.copySignal, null); assert.equal(collection.errorCode, null);
  assert.deepEqual(collection.traces.map(row => row.captureName).sort(), requiredTripCaptureNames.slice().sort());
  assert.equal(Object.keys(collection.files).length, 6);
  for (const [path, hash] of Object.entries(collection.files)) {
    assert(/^primary-capture-diagnostics\/trip-change-[a-z0-9-]+-\d{1,20}\.json$/.test(path));
    const bytes = read(path); assert.equal(createHash('sha256').update(bytes).digest('hex'), hash);
    const trace = JSON.parse(bytes); assert.equal(validatePrimaryCaptureDiagnostic(trace).complete, true);
    assert.equal(trace.primaryOutcome, 'returned'); assert.equal(trace.sdkInvocations, 1);
    assert.equal(trace.callerIsMain, false); assert.equal(trace.errorCategory, 'none');
    assert(path.startsWith('primary-capture-diagnostics/' + trace.captureName.replace(/\.png$/, '') + '-'));
    assert.deepEqual(collection.traces.find(row => row.captureName === trace.captureName), {
      captureName: trace.captureName, primaryOutcome: trace.primaryOutcome, errorCategory: trace.errorCategory,
      elapsedMs: trace.elapsedMs, primaryElapsedMs: trace.primaryElapsedMs,
      primaryStartOffsetMs: trace.primaryStartOffsetMs, complete: true,
    });
  }
  const hashes = JSON.parse(read('artifact-sha256.json'));
  assert.deepEqual(Object.keys(hashes).sort(), ['analysis.json', 'collection.json', 'ordinary-results.json',
    'native-suite-status.json', 'pr.json', ...Object.keys(collection.files)].sort());
  for (const [path, hash] of Object.entries(hashes)) assert.equal(createHash('sha256').update(read(path)).digest('hex'), hash);
}

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { assertRetainedSourceFiles } from './retained-source-evidence.mjs';

export const captureInvestigationFolder = 'docs/release/evidence/capture-callback-investigation-2026-10-26/';
export function validateCaptureInvestigationReport(report) {
  assert.equal(report.scope, 'passing-baseline-and-local-sdk-inspection-not-runtime-probe-or-root-cause-proof');
  assert.equal(report.baselineHead, '95d008152ee843e24c7dc8bf75ca1bcdbeba0cd8');
  assert.equal(report.localLibrary.version, '1.10.6'); assert.equal(report.localLibrary.callbackDispatcher, 'android-main-looper');
  assert.equal(report.localLibrary.callbackWaitMs, 1000);
  for (const key of ['aarSha256', 'sourceJarSha256', 'testApkSha256']) assert.match(report.artifactHashes[key], /^[a-f0-9]{64}$/);
  assert.equal(report.probe.testApkCompiled, true); assert.equal(report.probe.contractCasesCompiled, 4);
  for (const key of ['contractCasesExecuted', 'runtimeTimingCollected', 'primaryApiModified', 'primaryDeadlineModified',
    'outerRetryAdded', 'alternateCaptureAdded', 'rootCauseProven', 'physicalDevice', 'newScreenshotsAccepted', 'releaseAccepted'])
    assert.equal(report.probe[key], false, key);
}
export function validateCaptureCallbackInvestigation(root) {
  const read = path => readFileSync(resolve(root, captureInvestigationFolder, path));
  const report = JSON.parse(read('analysis.json')); validateCaptureInvestigationReport(report);
  assertRetainedSourceFiles(root, report.sourceFiles);
  const pr = JSON.parse(read('baseline-pr.json')), verified = JSON.parse(read('baseline-verification.json'));
  assert.equal(pr.headRefOid, report.baselineHead); assert.equal(verified.headRefOid, report.baselineHead);
  assert.equal(verified.ok, true); assert.deepEqual(verified.failed, []); assert.deepEqual(verified.incomplete, []); assert.deepEqual(verified.missing, []);
  assert.equal(pr.statusCheckRollup.length, 25);
  assert(verified.results.every(row => row.ok === true && pr.statusCheckRollup.some(check => check.name === row.name &&
    check.status === row.status && check.conclusion === row.conclusion && check.detailsUrl === row.detailsUrl)));
  assert.equal(pr.statusCheckRollup.filter(row => row.conclusion === 'SUCCESS').length, 20);
  assert(pr.statusCheckRollup.every(row => row.status === 'COMPLETED'));
  assert.deepEqual(pr.statusCheckRollup.filter(row => row.conclusion === 'SKIPPED').map(row => row.name).sort(),
    ['Android approved real-map UI integration', 'Android approved vehicle-map UI', 'Android approved parent search and booking',
      'iOS native checks', 'iOS native UI tests'].sort());
  assert(pr.statusCheckRollup.some(row => row.name === 'Android native UI tests' && row.conclusion === 'SUCCESS' &&
    row.detailsUrl.endsWith('/40325155790/job/121579832539')));
  const ordinary = JSON.parse(read('ordinary-results.json'));
  assert.equal(ordinary.complete, true); assert.equal(ordinary.guardConfirmed, true);
  assert.deepEqual([ordinary.caseCount, ordinary.passed, ordinary.skipped, ordinary.failed], [224, 170, 54, 0]);
  assert.equal(ordinary.productionWritesAccepted, false); assert.equal(ordinary.physicalDeviceAccepted, false);
  assert(ordinary.cases.every(row => ['passed', 'skipped'].includes(row.status)));
  const suite = JSON.parse(read('native-suite-status.json'));
  for (const key of ['ordinaryTests', 'componentEvidence', 'localReplay']) assert.equal(suite[key], 0);
  assert(read('dependency-insight.txt').toString().includes('androidx.compose.ui:ui-test-android:1.10.6'));
  const sdk = read('sdk-window-source.txt').toString(), bytecode = read('sdk-window-bytecode.txt').toString();
  assert(sdk.includes('Handler(Looper.getMainLooper())')); assert(sdk.includes('latch.await(1, TimeUnit.SECONDS)'));
  assert(bytecode.includes('Method android/os/Looper.getMainLooper')); assert(bytecode.includes('String Failed waiting for PixelCopy!'));
  assert.equal((read('probe-signatures.txt').toString().match(/public final void \w+\(\);/g) ?? []).length, 4);
  const hashes = JSON.parse(read('artifact-sha256.json'));
  assert.deepEqual(Object.keys(hashes).sort(), ['analysis.json', 'baseline-pr.json', 'baseline-verification.json',
    'ordinary-results.json', 'native-suite-status.json', 'dependency-insight.txt', 'sdk-window-source.txt',
    'sdk-window-bytecode.txt', 'probe-signatures.txt'].sort());
  for (const [path, hash] of Object.entries(hashes)) assert.equal(createHash('sha256').update(read(path)).digest('hex'), hash);
}

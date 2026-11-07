import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, cpSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { XMLParser } from 'fast-xml-parser';
import { validateNativeStartupReport, validateRetainedNativeStartup } from '../scripts/qa/native-startup-retained-evidence.mjs';
import { assertRetainedSourceFiles } from '../scripts/qa/retained-source-evidence.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = 'docs/release/evidence/native-startup-pass-2026-10-19/native-startup-results.json';
const report = JSON.parse(readFileSync(resolve(root, source)));
test('native startup is backed by an original completed case, primary transfer, stored state and cleanup', () => {
  assert.equal(validateRetainedNativeStartup(root, source).runId, report.runId);
});
test('counts alone, invalid captures, missing cleanup and broader device claims cannot accept the trial', () => {
  for (const key of ['physicalDevice', 'providerTrackingVerified', 'mapMovementVerified', 'productionWrites', 'safetyAuditAccepted',
    'storeReviewAccepted', 'realNetworkLossVerified']) assert.throws(() => validateNativeStartupReport({ ...report, [key]: true }));
  for (const key of ['duplicateStarted', 'invalidPreventedStart', 'mockPermissionRestored', 'localPackagesRemoved',
    'isolatedEnvironmentDestroyed', 'emulatorCliExitedSuccessfully'])
    assert.throws(() => validateNativeStartupReport({ ...report, [key]: false }));
  const changed = structuredClone(report); changed.receipts.duplicate.receipts[0].status = 'invalid';
  assert.throws(() => validateNativeStartupReport(changed));
  const missing = structuredClone(report); delete missing.receipts.duplicate.receipts;
  assert.throws(() => validateNativeStartupReport(missing));
});
test('unit counts and the ten actual concurrent ordering groups retain their own source and limited scope', () => {
  const base = resolve(root, 'docs/release/evidence/native-startup-checks-2026-10-19');
  const unit = JSON.parse(readFileSync(resolve(base, 'unit-results.json')));
  assert.equal(unit.scope, 'source-bound-unit-tests-not-native-or-physical-evidence');
  assert.equal(unit.nativeUiExecuted, false); assert.equal(unit.physicalDevice, false); assert.equal(unit.releaseAcceptance, false);
  assertRetainedSourceFiles(root, unit.sourceFiles);
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '' });
  const totals = { tests: 0, failures: 0, errors: 0, skipped: 0 };
  for (const file of readdirSync(resolve(base, 'android'))) {
    const suite = parser.parse(readFileSync(resolve(base, 'android', file), 'utf8')).testsuite;
    for (const key of Object.keys(totals)) totals[key] += Number(suite[key] ?? 0);
  }
  assert.deepEqual(totals, { tests: 388, failures: 0, errors: 0, skipped: 0 });
  assert.deepEqual(unit.android, totals);
  const backend = parser.parse(readFileSync(resolve(base, 'functions.xml'), 'utf8')).testsuites;
  assert.equal(Number(backend.tests), 352); assert.equal(Number(backend.failures), 0); assert.equal(Number(backend.errors), 0);
  const order = JSON.parse(readFileSync(resolve(base, 'location-order.json')));
  assert.equal(order.scope, 'local-emulated-services-not-phone-ui'); assert.equal(order.checks.length, 10);
  assert(order.checks.every((item) => item.status === 'passed')); assert.equal(order.concurrentRequestCount, 12);
  for (const key of ['nativeUiExecuted', 'physicalDevice', 'productionWrites', 'providerWebhookDelivery', 'auditAcceptance'])
    assert.equal(order[key], false);
  assertRetainedSourceFiles(root, order.sourceFiles);
});
test('changed transcripts, markers, primary receipts and images cannot inherit a native pass', () => {
  const folder = mkdtempSync(resolve(tmpdir(), 'sgm-startup-tamper-'));
  try {
    cpSync(resolve(root, 'docs'), resolve(folder, 'docs'), { recursive: true, filter: (path) =>
      !path.includes('/evidence/') || path.includes('/source-archive') || path.includes('/native-startup-pass-2026-10-19') || path.endsWith('/evidence') });
    const base = resolve(folder, source, '..');
    for (const file of ['LocalNativeTrackingStartupTest-instrumentation.txt', 'local-native-startup-device.json',
      'adb-pull-native-startup.json', 'local-native-startup-resumed.png']) {
      const original = readFileSync(resolve(base, file)); writeFileSync(resolve(base, file), 'tampered');
      assert.throws(() => validateRetainedNativeStartup(folder, source), undefined, file);
      writeFileSync(resolve(base, file), original);
    }
  } finally { rmSync(folder, { recursive: true, force: true }); }
});
test('the earlier cleanup failure and stale UI message remain negative despite the original case passing', () => {
  const base = resolve(root, 'docs/release/evidence/native-startup-cleanup-failure-2026-10-19');
  const original = JSON.parse(readFileSync(resolve(base, 'failure-context.json')));
  assert.equal(original.accepted, false); assert.equal(original.originalNativeCasePassed, true);
  assert.equal(original.fixtureCleanupVerified, false); assert.equal(original.staleErrorVisibleAfterResume, true);
  assert.notEqual(original.runId, report.runId);
  for (const [file, hash] of Object.entries(JSON.parse(readFileSync(resolve(base, 'artifact-sha256.json')))))
    assert.equal(createHash('sha256').update(readFileSync(resolve(base, file))).digest('hex'), hash);
});
test('the latest full replay remains a retained startup ANR without an invented success report', () => {
  const base = resolve(root, 'docs/release/evidence/native-startup-replay-anr-2026-10-19');
  const read = (file) => readFileSync(resolve(base, file));
  assert.match(read('LocalThemeRestartTest-instrumentation.txt').toString(), /Process crashed/);
  assert.match(read('LocalThemeRestartTest-exit-info.txt').toString(), /reason=6 \(ANR\)/);
  assert.equal(existsSync(resolve(base, 'results.json')), false);
  for (const [file, hash] of Object.entries(JSON.parse(read('artifact-sha256.json'))))
    assert.equal(createHash('sha256').update(read(file)).digest('hex'), hash);
});

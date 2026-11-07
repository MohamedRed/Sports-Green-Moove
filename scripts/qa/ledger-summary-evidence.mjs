import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { assertEvidenceBundleChecksums } from './evidence-bundle-checksums.mjs';
import { assertRetainedSourceFiles } from './retained-source-evidence.mjs';
import { assertInstrumentationPassed } from './android-instrumentation-result.mjs';

export function validateLedgerSummaryEvidence(root, record) {
  const base = dirname(resolve(root, record.source)), json = file => JSON.parse(readFileSync(resolve(base, file)));
  assert.equal(resolve(root, record.checksums), resolve(base, 'artifact-sha256.json'));
  const summary = json('summary.json'), services = json('services.json'), native = json('native.json');
  assert.equal(summary.checkedAt, record.checkedAt); assert.equal(native.testedAt.slice(0, 10), record.checkedAt);
  assert.equal(services.testedAt.slice(0, 10), record.checkedAt);
  assert.equal(summary.scope, 'isolated-complete-ledger-summaries-not-production');
  assert.equal(summary.productionDeployed, false); assert.equal(summary.releaseComplete, false);
  assert.equal(services.scope, 'isolated-ledger-summary-services-not-native-ui-or-production');
  assert.equal(native.scope, 'connected-isolated-android-ledger-history-not-physical');
  assert.equal(services.checks.length, 8); assert(services.checks.every(row => row.status === 'passed'));
  assert.equal(new Set(services.checks.map(row => row.id)).size, 8);
  assert.equal(services.legacy.rewards.limitedBalanceCents, 10_000); assert.equal(services.legacy.rewards.completeBalanceCents, -22_000);
  assert.equal(services.summaries.rewards.balanceCents, -22_000); assert.equal(services.summaries.rewards.entries.length, 8);
  assert.equal(services.summaries.impact.totalCo2Kg, 321.25); assert.equal(services.summaries.impact.rideCount, 257);
  assert.equal(native.balanceCents, -22_000); assert.equal(native.totalCo2Kg, 321.25); assert.equal(native.rideCount, 257);
  assert.equal(native.connectedCases, 1); assert.equal(native.historyCount, 8); assert.equal(native.providerRequests, 0);
  for (const report of [services, native]) {
    assert.equal(report.projectId, 'demo-sgm-local-qa'); assert.match(report.runId, /^[a-f0-9]{32}$/);
    for (const key of ['adminClientClosed', 'firestoreClientTerminated']) assert.equal(report[key], true);
    assert.equal(report.productionWrites, false); assertRetainedSourceFiles(root, report.sourceFiles);
  }
  for (const path of ['functions/src/domain/ledgerSummaries.ts', 'functions/src/services/ledgerSummaries.ts',
    'functions/src/callables/ledgerSummaries.ts', 'scripts/qa/ledger-history-services-suite.mjs']) assert(services.sourceFiles[path]);
  for (const path of ['android/app/src/main/java/be/sportgreenmoove/app/services/FirebaseAndroidLedgerGateway.kt',
    'android/app/src/main/java/be/sportgreenmoove/app/services/LedgerSummaryWire.kt',
    'android/app/src/androidTest/java/be/sportgreenmoove/app/ui/LocalLedgerHistoryFlowTest.kt']) assert(native.sourceFiles[path]);
  assert.deepEqual(Object.keys(native.apkHashes).sort(), ['apk/androidTest/debug/app-debug-androidTest.apk', 'apk/debug/app-debug.apk']);
  for (const hash of Object.values(native.apkHashes)) assert.match(hash, /^[a-f0-9]{64}$/);
  for (const key of ['nativeUiExecuted', 'activityRecreation', 'accountSwitch', 'protectedRecordsUnchanged', 'claimsUnchanged', 'localPackagesRemoved'])
    assert.equal(native[key], true, key);
  assert.equal(native.fullProcessRestart, false); assert.equal(native.physicalDevice, false);
  assert.equal(native.temporaryAdministrationUsed, false); assert.equal(services.realPayments, false); assert.equal(services.releaseComplete, false);
  const marker = json('ledger-history-device.json');
  for (const key of ['runId', 'projectId', 'scope', 'balanceCents', 'totalCo2Kg', 'rideCount', 'historyCount', 'activityRecreation', 'accountSwitch', 'fullProcessRestart'])
    assert.deepEqual(marker[key], native[key]);
  assert.equal(marker.completed, true);
  assertInstrumentationPassed(readFileSync(resolve(base, 'LocalLedgerHistoryFlowTest-instrumentation.txt'), 'utf8'), 1);
  const copy = json('adb-pull-ledger-history.json');
  assert.equal(copy.runId, native.runId); assert.equal(copy.phase, 'ledger-history'); assert.equal(copy.status, 0);
  assert.equal(copy.signal, null); assert.equal(copy.completed, true);
  const environment = json('environment-cleanup.json'); assert.equal(environment.runId, native.runId);
  assert.equal(environment.runtimeDirectoryAbsent, true); assert.deepEqual(environment.endpointsVerifiedClosed, [9099, 8080, 9000, 5001]);
  const cleanup = json('device-cleanup.json'); assert.equal(cleanup.avdName, 'sgm_ledger_history_20261024');
  for (const key of ['localPackagesAbsent', 'consoleStopAcknowledged', 'hostExited', 'deviceAbsent', 'avdDeleted', 'portsClosed'])
    assert.equal(cleanup[key], true, key);
  assert.equal(cleanup.temporaryAdministrationUsed, false);
  const review = json('visual-review.json'); assert.equal(review.reviewed, true); assert.equal(review.containsRealCustomerData, false);
  assert.deepEqual([...Object.keys(review.published), ...Object.keys(review.excluded)].sort(), Object.keys(native.screenshots).sort());
  assert(Object.values(review.published).every(value => value === true));
  assert(Object.values(review.excluded).every(value => typeof value === 'string' && value.length > 0));
  const hash = bytes => createHash('sha256').update(bytes).digest('hex');
  for (const [file, expected] of Object.entries(native.screenshots))
    assert.equal(hash(readFileSync(resolve(base, 'captures', file))), expected);
  assertRetainedSourceFiles(root, json('legacy-native-source.json'));
  assertEvidenceBundleChecksums(base);
  return summary;
}

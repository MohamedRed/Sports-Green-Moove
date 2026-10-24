import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { assertEvidenceBundleChecksums } from './evidence-bundle-checksums.mjs';
import { assertRetainedSourceFiles } from './retained-source-evidence.mjs';
import { assertInstrumentationPassed } from './android-instrumentation-result.mjs';

export function validateProfileCityReports(service, native) {
  assert.equal(service.projectId, 'demo-sgm-local-qa'); assert.equal(native.projectId, service.projectId);
  assert.equal(service.scope, 'authenticated-isolated-profile-city-services-not-native-ui');
  assert.equal(native.scope, 'connected-isolated-android-profile-city-not-physical');
  assert.equal(service.checks.length, 10); assert(service.checks.every(check => check.status === 'passed'));
  assert.equal(new Set(service.checks.map(check => check.id)).size, 10);
  assert.equal(native.connectedCases, 1); assert.equal(native.componentCases, 3);
  assert.equal(native.parentRevision, 2); assert.equal(native.driverRevision, 1);
  for (const key of ['protectedRecordsUnchanged', 'claimsUnchanged', 'activityRecreation', 'localPackagesRemoved'])
    assert.equal(native[key], true, key);
  for (const report of [service, native]) {
    assert.match(report.runId, /^[a-f0-9]{32}$/);
    for (const key of ['adminClientClosed', 'firestoreClientTerminated']) assert.equal(report[key], true, key);
    assert.equal(report.productionWrites, false); assert.equal(report.physicalDevice, false); assert.equal(report.providerRequests, 0);
  }
  assert.equal(native.fullProcessRestart, false); assert.equal(native.temporaryAdministrationUsed, false);
}

export function validateProfileCityEvidence(root, record) {
  const base = dirname(resolve(root, record.source));
  assert.equal(resolve(root, record.checksums), resolve(base, 'artifact-sha256.json'));
  const json = file => JSON.parse(readFileSync(resolve(base, file)));
  const summary = json('summary.json'), service = json('services.json'), native = json('native.json');
  validateProfileCityReports(service, native);
  assert.equal(summary.scope, 'profile-only-city-isolated-services-and-android-not-production');
  assert.equal(summary.checkedAt, record.checkedAt);
  assert.equal(native.testedAt.slice(0, 10), summary.checkedAt);
  assert.equal(summary.productionDeployed, false); assert.equal(summary.releaseComplete, false);
  for (const report of [service, native]) assertRetainedSourceFiles(root, report.sourceFiles);
  for (const [file, count] of [['ProfileCityFlowTest-instrumentation.txt', 3], ['LocalProfileCityFlowTest-instrumentation.txt', 1]])
    assertInstrumentationPassed(readFileSync(resolve(base, file), 'utf8'), count);
  const device = json('profile-city-device.json');
  assert.equal(device.runId, native.runId); assert.equal(device.completed, true);
  const review = json('visual-review.json');
  assert.equal(review.reviewed, true); assert.equal(review.containsRealCustomerData, false);
  assert(Object.values(review.published).every(value => value === true));
  assert.deepEqual([...Object.keys(review.published), ...Object.keys(review.excluded)].sort(), Object.keys(native.screenshots).sort());
  assert(Object.values(review.excluded).every(value => typeof value === 'string' && value.length > 0));
  const hashes = json('artifact-sha256.json');
  for (const [file, hash] of Object.entries(native.screenshots)) assert.equal(hashes['captures/' + file], hash);
  const cleanup = json('device-cleanup.json');
  assert.equal(cleanup.avdName, 'sgm_profile_city_20261024');
  for (const key of ['localPackagesAbsent', 'consoleStopAcknowledged', 'hostExited', 'deviceAbsent', 'avdDeleted', 'portsClosed'])
    assert.equal(cleanup[key], true, key);
  assert.equal(cleanup.temporaryAdministrationUsed, false);
  assertEvidenceBundleChecksums(base);
  return summary;
}

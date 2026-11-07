import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve, basename } from 'node:path';
import { createHash } from 'node:crypto';
import { assertRetainedSourceFiles } from './retained-source-evidence.mjs';
import { assertInstrumentationPassed } from './android-instrumentation-result.mjs';

export const vehicleMapGroups = [
  'missing-location-is-not-replaced-with-a-route-anchor', 'old-position-keeps-its-original-time-and-stale-status',
  'parent-and-driver-read-the-actual-selected-vehicle-coordinates-without-child-coordinates',
  'invalid-future-and-delayed-inputs-do-not-move-the-retained-position', 'different-ride-child-or-replaced-driver-points-are-not-exposed',
  'authentication-participation-and-write-role-are-enforced-before-coordinate-access', 'completion-removes-the-active-coordinate-response',
];
export function validateVehicleMapServices(report) {
  assert.equal(report.scope, 'local-emulated-services-not-phone-ui'); assert.equal(report.projectId, 'demo-sgm-local-qa');
  assert.match(report.runId, /^[a-f0-9]{32}$/); assert.equal(report.testCount, 1);
  assert.deepEqual(report.steps, [{ id: 'vehicle-map-points', status: 'passed' }]);
  assert.deepEqual(report.checks, vehicleMapGroups.map((id) => ({ id, status: 'passed' })));
  for (const key of ['nativeUiExecuted', 'physicalDevice', 'mapSdkVerified', 'mapMovementVerified', 'productionWrites']) assert.equal(report[key], false);
  assert.equal(report.providerRequests, 0);
  for (const key of ['adminClientClosed', 'emulatorCliExitedSuccessfully', 'isolatedEnvironmentDestroyed']) assert.equal(report[key], true);
  for (const key of ['baselineRecordsPreserved', 'otherLiveRidesPreserved', 'zeroDistanceImpactVerified']) assert.equal(report.isolation[key], true);
  assert.equal(report.isolation.createdRecordCounts.rewardLedger, 0);
  assert.equal(report.completion.completionVerified, true); assert.equal(report.completion.claimsUnchanged, true);
  assert.deepEqual(report.emulatorEndpoints, { host: '127.0.0.1', ports: [9099, 8080, 9000, 5001], closed: true });
}
export function validateRetainedVehicleMapServices(root, source) {
  const dir = dirname(resolve(root, source));
  const report = JSON.parse(readFileSync(resolve(root, source))); validateVehicleMapServices(report);
  assertRetainedSourceFiles(root, report.sourceFiles);
  assertRetainedSourceFiles(root, JSON.parse(readFileSync(resolve(dir, 'implementation-source-hashes.json'))));
  const transcript = readFileSync(resolve(dir, 'services.txt'), 'utf8');
  assert(transcript.includes('Seven authenticated coordinate groups passed; actual map rendering remains unverified.'));
  assert(transcript.includes('Script exited successfully (code 0)'));
  for (const [name, hash] of Object.entries(JSON.parse(readFileSync(resolve(dir, 'artifact-sha256.json'))))) {
    assert.equal(basename(name), name);
    assert.equal(createHash('sha256').update(readFileSync(resolve(dir, name))).digest('hex'), hash);
  }
  return report;
}
export function validateVehicleMapLayout(root, source) {
  const dir = dirname(resolve(root, source)), report = JSON.parse(readFileSync(resolve(root, source)));
  assert.equal(report.scope, 'native-component-layout-without-map-renderer-or-backend'); assert.equal(report.nativeCaseCount, 2);
  for (const key of ['physicalDevice', 'mapSdkVerified', 'applicationBackendConnected']) assert.equal(report[key], false);
  assert.equal(report.localPackagesRemoved, true); assert.equal(report.cases.length, 2);
  for (const item of report.cases) {
    assert.equal(item.scope, report.scope); assert.equal(item.arrivalOutsideMap, true); assert.equal(item.textWithinViewport, true);
  }
  assertRetainedSourceFiles(root, report.sourceFiles);
  const bytes = readFileSync(resolve(dir, 'VehicleMapLayoutTest-instrumentation.txt'));
  assertInstrumentationPassed(bytes.toString(), 2); assert.equal(createHash('sha256').update(bytes).digest('hex'), report.transcriptSha256);
  const receipt = JSON.parse(readFileSync(resolve(dir, 'adb-pull-vehicle-map-layout.json')));
  assert.equal(receipt.runId, report.runId); assert.equal(receipt.completed, true); assert.equal(receipt.phase, 'vehicle-map-layout');
  assert.equal(Object.keys(report.screenshots).length, 2);
  for (const [name, hash] of Object.entries(report.screenshots))
    assert.equal(createHash('sha256').update(readFileSync(resolve(dir, name))).digest('hex'), hash);
  return report;
}

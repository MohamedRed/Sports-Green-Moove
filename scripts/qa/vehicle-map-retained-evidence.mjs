import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve, isAbsolute } from 'node:path';
import { assertVehicleMapDisplay } from './vehicle-map-display-evidence.mjs';
import { assertRetainedSourceFiles } from './retained-source-evidence.mjs';
import { assertInstrumentationPassed } from './android-instrumentation-result.mjs';

export function validateRetainedVehicleMapDisplay(root, source) {
  const directory = dirname(resolve(root, source)), base = dirname(directory);
  const bytes = (file) => readFileSync(resolve(directory, file));
  const json = (file) => JSON.parse(bytes(file));
  const report = JSON.parse(readFileSync(resolve(root, source)));
  assert.match(report.runId, /^[a-f0-9]{32}$/); assert(report.rideSessionId);
  assertVehicleMapDisplay(report, report.runId, report.rideSessionId, directory);
  assert.equal(report.testCount, 1); assert.equal(report.nativeCaseCount, 1);
  assert.equal(report.primaryEvidencePhase, 'vehicle-map'); assert.equal(report.cleanupMode, 'destroy-owned-local-environment');
  for (const key of ['nativeUiExecuted', 'adminClientClosed', 'localPackagesRemoved',
    'isolatedEnvironmentDestroyed', 'emulatorCliExitedSuccessfully']) assert.equal(report[key], true, key);
  for (const key of ['productionWrites', 'safetyAuditAccepted', 'storeReviewAccepted']) assert.equal(report[key], false, key);
  assert.deepEqual(report.emulatorEndpoints, { host: '127.0.0.1', ports: [9099, 8080, 9000, 5001], closed: true });
  assert.equal(report.fixtureIsolation.baselineRecordsPreserved, true);
  assert.equal(report.fixtureIsolation.otherLiveRidesPreserved, true);
  assert.deepEqual(report.fixtureIsolation.createdRecordCounts,
    { trips: 1, bookings: 1, rideSessions: 1, notifications: 1, co2Ledger: 0, rewardLedger: 0 });
  for (const [key, value] of Object.entries(json('local-vehicle-map-device.json'))) assert.deepEqual(report[key], value, key);
  const { isolatedEnvironmentDestroyed, emulatorCliExitedSuccessfully, emulatorEndpoints, ...appFields } = report;
  assert.deepEqual(json('vehicle-map-app-results.json'), appFields);
  const pull = json('adb-pull-vehicle-map.json');
  assert.equal(pull.runId, report.runId); assert.equal(pull.projectId, report.projectId);
  assert.equal(pull.phase, 'vehicle-map'); assert.equal(pull.completed, true); assert.equal(pull.status, 0);
  assert.equal(pull.signal, null); assert.equal(pull.errorCode, null);
  const transcript = bytes('LocalVehicleMapFlowTest-instrumentation.txt');
  assertInstrumentationPassed(transcript.toString(), 1);
  const sha = (value) => createHash('sha256').update(value).digest('hex');
  assert.equal(sha(transcript), report.transcriptSha256);
  for (const file of ['scripts/qa/vehicle-map-display-evidence.mjs', 'scripts/qa/run-isolated-ride-ui.mjs',
    'android/app/src/androidTest/java/be/sportgreenmoove/app/ui/VehicleMarkerDisplayEvidence.kt',
    'android/app/src/main/java/be/sportgreenmoove/app/ui/VehicleMapMarker.kt']) assert(report.sourceFiles[file]);
  assert(Object.keys(report.sourceFiles).length >= 13); assertRetainedSourceFiles(root, report.sourceFiles);
  const setup = json('../disposable-device-setup.json'), restored = json('../disposable-store-restore.json');
  assert.equal(restored.restored, true); assert.equal(restored.verified, true);
  assert.deepEqual(restored.observed.mapsRuntime, setup.mapsRuntime);
  assert.equal(restored.observed.locationEnabled, true); assert.equal(restored.observed.noActiveStoreInstall, true);
  assert.deepEqual(restored.installAdmin, { authorizationRemoved: true, componentRemoved: true, originalPolicyRestored: true });
  const context = json('../retained-context.json'), run = json('../run.json');
  assert.equal(context.scope, 'completed-independent-local-map-movement-not-physical-tracking');
  assert.equal(context.orientation, 'portrait');
  assert.deepEqual(context.reviewedCaptures, ['local-vehicle-map-first.png', 'local-vehicle-map-moved.png']);
  for (const flag of ['physicalDevice', 'fullNativeSuiteVerified', 'providerTrackingVerified', 'childPositionsVerified', 'etaVerified'])
    assert.equal(context[flag], false, flag);
  assert.equal(run.databaseId, context.sourceRunId); assert.equal(run.headSha, context.sourceCommit);
  assert.equal(run.conclusion, 'success'); assert.equal(run.status, 'completed');
  assert.equal(run.jobs.find((job) => job.name.endsWith('/ Isolated vehicle-map display'))?.conclusion, 'success');
  const hashes = json('../artifact-sha256.json');
  for (const file of ['run.json', 'artifacts.json', 'disposable-device-setup.json', 'disposable-store-restore.json',
    'disposable-installations-activated.json', 'replay/vehicle-map-results.json', 'replay/vehicle-map-app-results.json',
    'replay/local-vehicle-map-device.json', 'replay/adb-pull-vehicle-map.json',
    'replay/LocalVehicleMapFlowTest-instrumentation.txt', 'replay/local-vehicle-map-first.png', 'replay/local-vehicle-map-moved.png',
    'replay/emulator-firestore-debug.log.txt', 'replay/emulator-database-debug.log.txt']) assert(hashes[file], file);
  for (const [file, hash] of Object.entries(hashes)) {
    assert(!isAbsolute(file) && !file.split('/').includes('..'));
    assert.equal(sha(readFileSync(resolve(base, file))), hash, file);
  }
  return report;
}

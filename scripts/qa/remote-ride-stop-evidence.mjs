import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve, basename } from 'node:path';
import { assertInstrumentationPassed } from './android-instrumentation-result.mjs';
import { assertRetainedSourceFiles } from './retained-source-evidence.mjs';

export const remoteRideStopScope = 'local-remote-completion-service-stop-not-physical-background-gps';
export function validateRemoteRideStopReport(report) {
  assert.equal(report.scope, remoteRideStopScope); assert.equal(report.projectId, 'demo-sgm-local-qa');
  assert.match(report.runId, /^[a-f0-9]{32}$/); assert.equal(report.testCount, 1); assert.equal(report.nativeCaseCount, 1);
  for (const key of ['rideSessionId', 'bookingId']) assert.match(report[key], /^[a-zA-Z0-9]{20}$/);
  assert.equal(report.childId, 'sgm-qa-child-lina'); assert(Object.keys(report.sourceFiles).length >= 16);
  assert.deepEqual(report.steps, [{ id: 'remote-ride-stop', status: 'passed' }]);
  assert.equal(report.primaryEvidencePhase, 'remote-ride-stop');
  for (const key of ['backgroundStopBeforeResume', 'driverStillSignedInAtStop', 'peerCompletionAcknowledged',
    'mockModeRestored', 'firestoreClientTerminated', 'nativeUiExecuted', 'mockPermissionRestored', 'adminClientClosed',
    'localPackagesRemoved', 'isolatedEnvironmentDestroyed', 'emulatorCliExitedSuccessfully']) assert.equal(report[key], true, key);
  for (const key of ['physicalDevice', 'providerTrackingVerified', 'physicalBackgroundGpsVerified',
    'productionWrites', 'safetyAuditAccepted', 'storeReviewAccepted']) assert.equal(report[key], false, key);
  assert.equal(report.cleanupMode, 'destroy-owned-local-environment');
  assert.deepEqual(report.emulatorEndpoints, { host: '127.0.0.1', ports: [9099, 8080, 9000, 5001], closed: true });
  assert.deepEqual(report.completion, { auditEventCount: 2, bookingCount: 1, co2LedgerCount: 1,
    completionVerified: true, claimsUnchanged: true });
  for (const key of ['baselineRecordsPreserved', 'otherLiveRidesPreserved', 'zeroDistanceImpactVerified'])
    assert.equal(report.isolation[key], true, key);
  for (const name of ['trips', 'bookings', 'rideSessions', 'co2Ledger']) assert.equal(report.isolation.createdRecordCounts[name], 1);
  assert.equal(report.isolation.createdRecordCounts.rewardLedger, 0);
  assert.deepEqual(Object.keys(report.screenshots).sort(), ['ended', 'started'].map((id) => `local-native-startup-remote-${id}.png`));
}
export function validateRetainedRemoteRideStop(root, source) {
  const directory = dirname(resolve(root, source)), read = (name) => readFileSync(resolve(directory, name));
  const json = (name) => JSON.parse(read(name)), sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
  const report = JSON.parse(readFileSync(resolve(root, source))); validateRemoteRideStopReport(report);
  const marker = json('local-remote-ride-stop-device.json');
  for (const key of Object.keys(marker)) assert.deepEqual(marker[key], report[key]);
  const checkpoint = json('local-remote-ride-stop-checkpoint.json');
  assert.equal(checkpoint.runId, report.runId); assert.equal(checkpoint.rideSessionId, report.rideSessionId);
  assert.equal(checkpoint.peerCompletionAcknowledged, true); assert.equal(checkpoint.appBackgrounded, true);
  const receipt = json('adb-pull-remote-ride-stop.json');
  assert.equal(receipt.runId, report.runId); assert.equal(receipt.phase, 'remote-ride-stop');
  assert.equal(receipt.completed, true); assert.equal(receipt.status, 0); assert.equal(receipt.signal, null); assert.equal(receipt.errorCode, null);
  const transcript = read('LocalRemoteRideStopFlowTest-instrumentation.txt');
  assertInstrumentationPassed(transcript.toString(), 1); assert.equal(sha(transcript), report.transcriptSha256);
  assertRetainedSourceFiles(root, report.sourceFiles);
  const context = json('retained-context.json');
  assert.equal(context.scope, 'completed-independent-local-remote-stop-not-release-readiness');
  assert.equal(context.runId, report.runId); assert.equal(context.reviewedCaptureCount, 2);
  assert.equal(context.publishedCaptureCount, 1); assert.equal(context.visualCompletenessVerified, false);
  assert.deepEqual(context.publishedCaptures, ['local-native-startup-remote-started.png']);
  assert.deepEqual(context.knownVisualDefects, ['local-native-startup-remote-ended.png']);
  assert.equal(context.fullNativeSuiteVerified, false); assert.equal(context.physicalDevice, false);
  for (const [name, hash] of Object.entries(report.screenshots)) assert.equal(sha(read(name)), hash);
  for (const [name, hash] of Object.entries(json('artifact-sha256.json'))) {
    assert.equal(basename(name), name); assert.equal(sha(read(name)), hash);
  }
  return report;
}

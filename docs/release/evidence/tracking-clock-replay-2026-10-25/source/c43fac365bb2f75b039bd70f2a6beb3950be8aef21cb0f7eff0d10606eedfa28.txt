import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { assertInstrumentationPassed } from './android-instrumentation-result.mjs';
import { assertRetainedSourceFiles } from './retained-source-evidence.mjs';
import {nativeClockStartupScope, validateNativeClockStartupReport} from './native-clock-startup-evidence.mjs';

export const nativeStartupCaptures = ['started', 'invalid', 'resumed', 'signed-out'].map((id) => `local-native-startup-${id}.png`);
export function validateNativeStartupReport(report) {
  if (report.scope === nativeClockStartupScope) return validateNativeClockStartupReport(report);
  assert.equal(report.scope, 'local-fused-mock-startup-not-physical-gps');
  assert(!Object.hasOwn(report, 'clockProtocolVersion'), 'The historical scope cannot stand in for a new clock protocol');
  assert.equal(report.projectId, 'demo-sgm-local-qa'); assert.match(report.runId, /^[a-f0-9]{32}$/);
  assert.equal(report.driverUid, 'sgm-qa-driver'); assert.equal(report.testCount, 1); assert.equal(report.nativeCaseCount, 1);
  assert.deepEqual(report.steps, [{ id: 'native-tracking-startup', status: 'passed' }]);
  assert.equal(report.primaryEvidencePhase, 'native-startup');
  assert.equal(report.captureMethod, 'render-enabled-decor-window-pixel-copy');
  for (const key of ['duplicateStarted', 'invalidPreventedStart', 'duplicateResumed', 'serviceStoppedOnSignOut',
    'mockModeRestored', 'driverSignedOut', 'nativeUiExecuted', 'mockPermissionRestored', 'isolatedEnvironmentDestroyed',
    'emulatorCliExitedSuccessfully',
    'adminClientClosed', 'localPackagesRemoved', 'firestoreClientTerminated']) assert.equal(report[key], true, key);
  for (const key of ['physicalDevice', 'providerTrackingVerified', 'mapMovementVerified', 'productionWrites',
    'safetyAuditAccepted', 'storeReviewAccepted', 'realNetworkLossVerified']) assert.equal(report[key], false, key);
  assert(Number.isSafeInteger(report.capturedAt) && report.capturedAt > 0);
  assert.equal(report.cleanupMode, 'destroy-owned-local-environment');
  assert.deepEqual(report.emulatorEndpoints, { host: '127.0.0.1', ports: [9099, 8080, 9000, 5001], closed: true });
  assert.equal(report.fixtureIsolation.baselineRecordsPreserved, true);
  assert.equal(report.fixtureIsolation.otherLiveRidesPreserved, true);
  for (const name of ['trips', 'bookings', 'rideSessions']) assert.equal(report.fixtureIsolation.createdRecordCounts[name], 1);
  for (const name of ['co2Ledger', 'rewardLedger']) assert.equal(report.fixtureIsolation.createdRecordCounts[name], 0);
  for (const [key, written, ignored, status] of [['first', 1, 0, 'written'], ['duplicate', 0, 1, 'retained']]) {
    const envelope = report.receipts[key]; assert.equal(envelope.written, written); assert.equal(envelope.ignored, ignored);
    assert.deepEqual(envelope.receipts, [{ status, rideSessionId: report.rideSessionId, role: 'driver', capturedAt: report.capturedAt }]);
  }
  assert.deepEqual(Object.keys(report.screenshots).sort(), [...nativeStartupCaptures].sort());
  assert(Object.keys(report.sourceFiles).length >= 16);
}

export function validateRetainedNativeStartup(root, source) {
  const directory = dirname(resolve(root, source)), read = (file) => readFileSync(resolve(directory, file));
  const json = (file) => JSON.parse(read(file)), sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
  const report = JSON.parse(readFileSync(resolve(root, source))); validateNativeStartupReport(report);
  assert.equal(report.scope, 'local-fused-mock-startup-not-physical-gps', 'Historical visual review only');
  const marker = json('local-native-startup-device.json'), receipt = json('adb-pull-native-startup.json');
  for (const key of Object.keys(marker)) assert.deepEqual(marker[key], report[key], key);
  assert.equal(receipt.projectId, report.projectId); assert.equal(receipt.runId, report.runId);
  assert.equal(receipt.phase, 'native-startup'); assert.equal(receipt.completed, true); assert.equal(receipt.status, 0);
  assert.equal(receipt.signal, null); assert.equal(receipt.errorCode, null);
  const transcript = read('LocalNativeTrackingStartupTest-instrumentation.txt');
  assertInstrumentationPassed(transcript.toString(), 1); assert.equal(sha(transcript), report.transcriptSha256);
  assertRetainedSourceFiles(root, report.sourceFiles);
  const context = json('retained-context.json');
  assert.equal(context.runId, report.runId); assert.equal(context.reviewedCaptureCount, 4);
  assert.equal(context.publishedCaptureCount, 2); assert.equal(context.visualCompletenessVerified, false);
  assert.deepEqual(context.publishedCaptures, ['local-native-startup-started.png', 'local-native-startup-signed-out.png']);
  assert.deepEqual(context.knownVisualDefects, ['local-native-startup-invalid.png', 'local-native-startup-resumed.png']);
  assert.equal(context.fullNativeSuiteVerified, false); assert.equal(context.physicalDevice, false);
  assert.equal(context.scope, 'completed-independent-local-native-startup-not-release-readiness');
  for (const file of nativeStartupCaptures) {
    const bytes = read(file); assert.equal(sha(bytes), report.screenshots[file]);
    assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert(bytes.readUInt32BE(16) >= 300 && bytes.readUInt32BE(20) > bytes.readUInt32BE(16));
  }
  for (const [file, hash] of Object.entries(json('artifact-sha256.json'))) {
    assert.equal(basename(file), file); assert.equal(sha(read(file)), hash, file);
  }
  return report;
}

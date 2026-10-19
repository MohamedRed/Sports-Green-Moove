import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { assertInstrumentationPassed } from './android-instrumentation-result.mjs';
import { assertRetainedSourceFiles } from './retained-source-evidence.mjs';
import { XMLParser } from 'fast-xml-parser';

export const rideObservationCaptures = ['fresh', 'fresh-landscape', 'stale', 'recovered', 'pickup', 'resumed', 'ended', 'history']
  .map((id) => `local-ride-observation-${id}.png`);

export function validateRideObservationReport(report) {
  assert.equal(report.scope, 'local-ride-live-sdk-not-physical-gps');
  assert.equal(report.projectId, 'demo-sgm-local-qa'); assert.match(report.runId, /^[a-f0-9]{32}$/);
  assert.equal(report.testCount, 1); assert.equal(report.nativeCaseCount, 1);
  assert.deepEqual(report.steps, [{ id: 'ride-observation-ui', status: 'passed' }]);
  assert(report.staleWaitElapsedMs > 80_000 && report.staleWaitElapsedMs < 120_000);
  assert.deepEqual(report.stored, { auditEventCount: 2, bookingCount: 1, co2LedgerCount: 1, completionVerified: true, claimsUnchanged: true });
  for (const key of ['isolatedFixtureCleanupVerified', 'adminClientClosed', 'nativeUiExecuted']) assert.equal(report[key], true, key);
  for (const key of ['physicalDevice', 'productionWrites', 'storeReviewAccepted', 'safetyAuditAccepted',
    'realNetworkLossVerified', 'mapMovementVerified', 'providerTrackingVerified']) assert.equal(report[key], false, key);
  assert.equal(report.primaryEvidencePhase, 'ride-observation');
  assert.deepEqual(Object.keys(report.screenshots).sort(), [...rideObservationCaptures].sort());
  for (const [before, after] of [['fresh', 'stale'], ['stale', 'recovered'], ['recovered', 'pickup'], ['pickup', 'resumed'], ['resumed', 'ended'], ['ended', 'history']])
    assert.notEqual(report.screenshots[`local-ride-observation-${before}.png`], report.screenshots[`local-ride-observation-${after}.png`]);
  assert(Object.keys(report.sourceFiles).length >= 20);
}

export function validateRetainedRideObservation(root, source) {
  const directory = dirname(resolve(root, source)), read = (file) => readFileSync(resolve(directory, file));
  const json = (file) => JSON.parse(read(file)), sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
  const report = JSON.parse(readFileSync(resolve(root, source))); validateRideObservationReport(report);
  const marker = json('local-ride-observation-device.json'), receipt = json('adb-pull-ride-observation.json');
  assert.equal(marker.scope, report.scope); assert.equal(marker.projectId, report.projectId); assert.equal(marker.runId, report.runId);
  assert.equal(marker.parentUid, 'sgm-qa-parent'); assert.equal(marker.driverUid, 'sgm-qa-driver');
  assert.equal(marker.parentSignedOut, true); assert.equal(marker.staleWaitElapsedMs, report.staleWaitElapsedMs);
  assert.deepEqual(marker.operations, { writeLocationBatch: 2, markPickup: 1, markDropoff: 1, endRide: 1 });
  for (const key of ['physicalDevice', 'providerTrackingVerified', 'mapMovementVerified']) assert.equal(marker[key], false);
  assert.equal(typeof report.fixture.tripId, 'string'); assert(report.fixture.tripId.length > 0);
  for (const key of ['rideSessionId', 'bookingId', 'childId']) assert.equal(marker[key], report.fixture[key]);
  assert.deepEqual(marker.screenshots, report.screenshots);
  assert.equal(receipt.projectId, report.projectId); assert.equal(receipt.runId, report.runId);
  assert.equal(receipt.phase, 'ride-observation'); assert.equal(receipt.completed, true); assert.equal(receipt.status, 0);
  assert.equal(receipt.signal, null); assert.equal(receipt.errorCode, null);
  const transcript = read('LocalRideObservationFlowTest-instrumentation.txt');
  assertInstrumentationPassed(transcript.toString(), 1); assert.equal(sha(transcript), report.transcriptSha256);
  assertRetainedSourceFiles(root, report.sourceFiles);
  const context = json('retained-context.json');
  assert.equal(context.runId, report.runId); assert.equal(context.reviewedCaptureCount, 8);
  assert.equal(context.fullNativeSuiteVerified, false); assert.equal(context.physicalDevice, false);
  assert.equal(context.scope, 'completed-independent-local-native-observation-not-release-readiness');
  for (const file of rideObservationCaptures) {
    const bytes = read(file); assert.equal(sha(bytes), report.screenshots[file]);
    assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert(bytes.readUInt32BE(16) >= 300 && bytes.readUInt32BE(20) >= 300);
    assert.equal(bytes.readUInt32BE(16) > bytes.readUInt32BE(20), file.includes('landscape'));
  }
  const checks = json('checks.json');
  assert.equal(checks.androidUnitCases, 379); assert.equal(checks.functionsUnitCases, 343);
  assert.equal(checks.failures, 0); assert.equal(checks.skipped, 0);
  assert.equal(checks.fullNativeSuiteVerified, false); assert.equal(checks.productionDeploymentVerified, false);
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '', parseAttributeValue: true });
  let unitCases = 0;
  for (const file of readdirSync(directory).filter((name) => name.startsWith('android-unit-') && name.endsWith('.xml'))) {
    const suite = parser.parse(read(file).toString()).testsuite;
    assert.equal(suite.failures, 0); assert.equal(suite.errors, 0); assert.equal(suite.skipped, 0);
    unitCases += suite.tests;
  }
  assert.equal(unitCases, checks.androidUnitCases);
  const backend = parser.parse(read('functions-unit.xml').toString()).testsuites;
  assert.equal(backend.tests, checks.functionsUnitCases); assert.equal(backend.failures, 0); assert.equal(backend.errors, 0);
  for (const [file, hash] of Object.entries(json('artifact-sha256.json'))) {
    assert.equal(basename(file), file); assert.equal(sha(read(file)), hash, file);
  }
  return report;
}

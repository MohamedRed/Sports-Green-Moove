import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve, basename } from 'node:path';
import { createHash } from 'node:crypto';
import { validateRideEmergencyDevice, rideEmergencyCaptures } from './ride-emergency-evidence.mjs';
import { assertInstrumentationPassed } from './android-instrumentation-result.mjs';
import { assertRetainedSourceFiles } from './retained-source-evidence.mjs';

export function validateRideEmergencyReport(report) {
  assert.equal(report.scope, 'local-active-ride-contact-with-sdk-and-dialer-not-physical');
  assert.equal(report.projectId, 'demo-sgm-local-qa'); assert.match(report.runId, /^[a-f0-9]{32}$/);
  assert.equal(report.testCount, 1); assert.equal(report.nativeCaseCount, 1);
  assert.deepEqual(report.steps, [{ id: 'ride-emergency-active-ui', status: 'passed' }]);
  assert.deepEqual(report.actors.map((actor) => actor.role), ['driver', 'parent']);
  for (const actor of report.actors) {
    assert.equal(actor.ownerUid, `sgm-qa-${actor.role}`);
    assert.equal(actor.dialIntentCount, 1); assert.equal(actor.directCallIntentCount, 0);
    assert.equal(actor.dialerNumberMatched, true); assert.equal(actor.returnedToSameRide, true);
  }
  assert.equal(report.privateOperationsVerified, 4);
  for (const key of ['contactValuesRemoved', 'contactNullRevisionsRetained', 'rideCompletionVerifiedSeparately',
    'nativeTrackingAccountIsolationVerified', 'driverResumedTrackingVerified', 'trackingPresenceNotGpsDelivery']) assert.equal(report[key], true, key);
  for (const key of ['physicalDevice', 'productionWrites', 'storeReviewAccepted', 'childOwnAccountDialImplemented']) assert.equal(report[key], false, key);
  assert.deepEqual(Object.keys(report.screenshots).sort(), [...rideEmergencyCaptures].sort());
}

export function validateRetainedRideEmergency(root, source) {
  const directory = dirname(resolve(root, source)), read = (file) => readFileSync(resolve(directory, file));
  const json = (file) => JSON.parse(read(file)), sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
  const report = JSON.parse(readFileSync(resolve(root, source)));
  validateRideEmergencyReport(report);
  const context = json('retained-context.json');
  assert.equal(context.scope, 'retained-completed-native-trial-not-current-head-or-physical-readiness');
  assert.equal(context.runId, report.runId); assert.match(context.sourceCommit, /^[a-f0-9]{40}$/);
  assert.equal(context.workflowConclusion, 'success'); assert.equal(context.nativeUiJob.conclusion, 'success');
  assert.equal(context.reviewedCaptureCount, 8); assert.equal(context.currentHeadComplete, false);
  assert.equal(context.physicalDevice, false); assert.equal(context.productionWrites, false); assert.equal(context.storeReviewAccepted, false);
  assert.deepEqual(context.sourceFiles, report.sourceFiles); assertRetainedSourceFiles(root, report.sourceFiles);
  const full = json('results.json');
  assert.equal(full.scope, 'local-ui-not-physical-device'); assert.equal(full.projectId, 'demo-sgm-local-qa');
  assert.equal(full.runId, report.runId); assert.equal(full.testCount, 36); assert.equal(full.nativeCaseCount, 38);
  assert.equal(full.steps.length, 36); assert(full.steps.every((step) => step.status === 'passed'));
  assert.equal(new Set(full.steps.map((step) => step.id)).size, 36);
  assert.equal(full.ride.auditEventCount, 4); assert.equal(full.ride.ratingCount, 1); assert.equal(full.ride.bookingCount, 2);
  assert.deepEqual(full.ride.emergency, report);
  const marker = json('local-ride-emergency-device.json');
  validateRideEmergencyDevice(marker, json('adb-pull-ride-emergency.json'), report.runId,
    { rideSessionId: full.ride.rideSessionId, tripId: report.actors[0].tripId }, read);
  assert.deepEqual(report.actors, marker.actors); assert.deepEqual(report.screenshots, marker.screenshots);
  const transcript = read('LocalRideFlowTest-instrumentation.txt');
  assertInstrumentationPassed(transcript.toString(), 1); assert.equal(report.transcriptSha256, sha(transcript));
  const tracking = ['driver-entry', 'driver-returned', 'parent-entry', 'parent-returned', 'driver-resumed'];
  const trackingFiles = tracking.map((key) => `local-ride-emergency-${key}-tracking.json`);
  assert.deepEqual(Object.keys(report.trackingObservations).sort(), trackingFiles.sort());
  for (const file of trackingFiles) {
    const observation = json(file), [role, phase] = file.replace('local-ride-emergency-', '').split('-');
    assert.equal(sha(read(file)), report.trackingObservations[file]);
    assert.equal(observation.scope, 'active-ride-tracking-account-observation-not-flow-proof');
    assert.equal(observation.runId, report.runId); assert.equal(observation.authenticatedUid, `sgm-qa-${role}`);
    assert.equal(observation.role, role); assert.equal(observation.phase, phase);
    assert.equal(observation.expectedRunning, role === 'driver'); assert.equal(observation.observedRunning, role === 'driver');
  }
  const suite = json('native-suite-status.json');
  for (const key of ['ordinaryTests', 'componentEvidence', 'localReplay']) assert.equal(suite[key], 0);
  const restored = json('disposable-store-restore.json');
  assert.equal(restored.restored, true); assert.equal(restored.verified, true);
  assert.deepEqual(restored.installAdmin, { authorizationRemoved: true, componentRemoved: true, originalPolicyRestored: true });
  for (const [file, expected] of Object.entries(json('artifact-sha256.json'))) {
    assert.equal(basename(file), file); assert.equal(sha(read(file)), expected, file);
  }
  return report;
}

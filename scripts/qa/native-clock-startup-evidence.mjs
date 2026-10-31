import assert from 'node:assert/strict';

export const nativeClockStartupScope = 'local-monotonic-clock-startup-not-physical-gps';
export const nativeClockStartupCaptures = ['started', 'ahead', 'resumed', 'signed-out'].map(id => `local-native-startup-${id}.png`);
export function assertNativeClockStartupMarker(marker) {
  assert.equal(marker.scope, nativeClockStartupScope); assert.equal(marker.clockProtocolVersion, 2);
  assert.equal(marker.projectId, 'demo-sgm-local-qa'); assert.match(marker.runId, /^[a-f0-9]{32}$/);
  assert.equal(marker.driverUid, 'sgm-qa-driver'); assert(Number.isSafeInteger(marker.capturedAt) && marker.capturedAt > 0);
  for (const key of ['retainedStarted', 'futureUploadRejected', 'wallAheadStarted', 'wallBehindResumed',
    'serviceStoppedOnSignOut', 'mockModeRestored', 'driverSignedOut', 'firestoreClientTerminated']) assert.equal(marker[key], true, key);
  for (const key of ['physicalDevice', 'providerTrackingVerified', 'mapMovementVerified']) assert.equal(marker[key], false, key);
  assert.equal(marker.captureMethod, 'render-enabled-decor-window-pixel-copy');
  assert.deepEqual(Object.keys(marker.screenshots).sort(), [...nativeClockStartupCaptures].sort());
  assert.deepEqual(Object.keys(marker.points).sort(), ['retainedStart', 'wallAhead', 'wallBehind']);
  const {retainedStart: first, wallAhead: ahead, wallBehind: behind} = marker.points;
  for (const point of [first, ahead, behind]) {
    assert.equal(point.rideSessionId, marker.rideSessionId); assert.equal(point.role, 'driver');
    assert.equal(point.userId, marker.driverUid); assert.equal(point.source, 'nativeFallback');
    assert(Number.isSafeInteger(point.capturedAt) && point.capturedAt > 0);
    assert(Number.isSafeInteger(point.uploadedAt) && point.uploadedAt >= point.capturedAt);
    assert(Number.isFinite(point.lat) && Math.abs(point.lat) <= 90); assert(Number.isFinite(point.lng) && Math.abs(point.lng) <= 180);
  }
  assert.equal(first.capturedAt, marker.capturedAt);
  assert.equal(first.captureClock, undefined); assert.equal(first.deviceCapturedAt, undefined);
  assert(ahead.capturedAt > first.capturedAt); assert(behind.capturedAt > ahead.capturedAt);
  for (const point of [ahead, behind]) {
    assert.equal(point.captureClock, 'serverElapsedRealtime'); assert(Number.isSafeInteger(point.deviceCapturedAt));
  }
  assert(ahead.deviceCapturedAt - ahead.capturedAt > 23 * 60 * 60_000);
  assert(behind.capturedAt - behind.deviceCapturedAt > 23 * 60 * 60_000);
  for (const [key, written, ignored, status] of [['first', 1, 0, 'written'], ['duplicate', 0, 1, 'retained'], ['future', 0, 1, 'invalid']]) {
    const envelope = marker.receipts[key]; assert.equal(envelope.written, written); assert.equal(envelope.ignored, ignored);
    assert(Number.isSafeInteger(envelope.serverTimeMs) && envelope.serverTimeMs > 0);
    assert.equal(envelope.receipts.length, 1);
    const receipt = envelope.receipts[0]; assert.equal(receipt.status, status);
    assert.equal(receipt.rideSessionId, marker.rideSessionId); assert.equal(receipt.role, 'driver');
    assert(Number.isSafeInteger(receipt.capturedAt));
    if (key === 'future') assert(receipt.capturedAt > envelope.serverTimeMs);
    else { assert.equal(receipt.capturedAt, marker.capturedAt); assert(receipt.capturedAt <= envelope.serverTimeMs); }
  }
  for (const key of ['invalidPreventedStart', 'duplicateStarted', 'duplicateResumed']) assert(!Object.hasOwn(marker, key));
}

export function validateNativeClockStartupReport(report) {
  assertNativeClockStartupMarker(report);
  assert.equal(report.testCount, 1); assert.equal(report.nativeCaseCount, 1);
  assert.deepEqual(report.steps, [{id: 'native-tracking-startup', status: 'passed'}]);
  assert.equal(report.primaryEvidencePhase, 'native-startup');
  for (const key of ['nativeUiExecuted', 'mockPermissionRestored', 'isolatedEnvironmentDestroyed', 'emulatorCliExitedSuccessfully',
    'adminClientClosed', 'localPackagesRemoved']) assert.equal(report[key], true, key);
  for (const key of ['productionWrites', 'safetyAuditAccepted', 'storeReviewAccepted', 'realNetworkLossVerified']) assert.equal(report[key], false, key);
  assert.equal(report.cleanupMode, 'destroy-owned-local-environment');
  assert.deepEqual(report.emulatorEndpoints, {host: '127.0.0.1', ports: [9099, 8080, 9000, 5001], closed: true});
  assert.equal(report.fixtureIsolation.baselineRecordsPreserved, true); assert.equal(report.fixtureIsolation.otherLiveRidesPreserved, true);
  for (const name of ['trips', 'bookings', 'rideSessions']) assert.equal(report.fixtureIsolation.createdRecordCounts[name], 1);
  for (const name of ['co2Ledger', 'rewardLedger']) assert.equal(report.fixtureIsolation.createdRecordCounts[name], 0);
  assert(Object.keys(report.sourceFiles).length >= 20);
}

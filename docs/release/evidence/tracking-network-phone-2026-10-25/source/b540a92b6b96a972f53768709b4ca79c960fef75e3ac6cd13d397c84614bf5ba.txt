import assert from 'node:assert/strict';
import {assertTrackingPhoneState} from './tracking-phone-state.mjs';
import {trackingPhonePoints} from './tracking-phone-checkpoints.mjs';

export const trackingNetworkPhases = ['prepared', 'foreground-first', 'offline-started', 'offline-stale',
  'resumed', 'signed-out', 'signed-out-stable'];

export function verifyTrackingNetworkCheckpoint(phase, state, baseline, fixture, previous, observedForMs = 0) {
  assert(trackingNetworkPhases.includes(phase));
  const stable = ['offline-stale', 'signed-out-stable'].includes(phase);
  if (stable) assert(Number.isFinite(observedForMs) && observedForMs >= 50_000);
  const point = ['resumed', 'signed-out', 'signed-out-stable'].includes(phase) ? trackingPhonePoints.moved : trackingPhonePoints.first;
  const checked = assertTrackingPhoneState(state, baseline, fixture,
    {active: phase !== 'prepared', point, previous, movement: phase === 'resumed', stable});
  if (phase !== 'prepared') {
    assert.equal(checked.vehicle.captureClock, 'serverElapsedRealtime');
    assert(Number.isSafeInteger(checked.vehicle.deviceCapturedAt));
    assert(checked.vehicle.capturedAt <= checked.vehicle.uploadedAt);
  }
  return {phase, ...checked, allOtherRootRecordsAndClaimsUnchanged: true, observedForMs,
    simulatedNetwork: true, simulatedLocations: true, phoneUiProven: false,
    realNetworkLossProven: false, realMovementProven: false, childTrackingProven: false,
    productionWrites: false, paymentExercised: false, routeProviderRequests: 0};
}

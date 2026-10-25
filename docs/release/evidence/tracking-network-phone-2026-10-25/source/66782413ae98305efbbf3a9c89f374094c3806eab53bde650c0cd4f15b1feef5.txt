import assert from 'node:assert/strict';
import {assertTrackingPhoneState} from './tracking-phone-state.mjs';

export const trackingPhonePhases = ['prepared', 'foreground-first', 'foreground-moved', 'background-moved',
  'foreground-returned', 'signed-out', 'signed-out-stable'];
export const trackingPhonePoints = {
  first: {lat: 50.7167, lng: 4.6167}, moved: {lat: 50.7177, lng: 4.6177},
  background: {lat: 50.7187, lng: 4.6187}, afterSignOut: {lat: 50.7197, lng: 4.6197},
};
export function verifyTrackingPhoneCheckpoint(phase, state, baseline, fixture, previous) {
  assert(trackingPhonePhases.includes(phase));
  const point = phase === 'foreground-first' ? trackingPhonePoints.first
    : phase === 'foreground-moved' ? trackingPhonePoints.moved : trackingPhonePoints.background;
  const checked = assertTrackingPhoneState(state, baseline, fixture, {active: phase !== 'prepared', point, previous,
    movement: Boolean(previous) && ['foreground-moved', 'background-moved'].includes(phase), stable: phase === 'signed-out-stable'});
  return {phase, ...checked, allOtherRootRecordsAndClaimsUnchanged: true,
    productionWrites: false, simulatedLocations: true, childTrackingProven: false, realMovementProven: false,
    phoneUiProven: false, paymentExercised: false, routeProviderRequests: 0};
}

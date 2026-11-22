import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

export const rideEmergencyRoles = ['driver', 'parent'];
export const rideEmergencyPhases = ['entry', 'saved', 'dialer', 'returned'];
export const rideEmergencyCaptures = rideEmergencyRoles.flatMap((role) =>
  rideEmergencyPhases.map((phase) => `local-ride-emergency-${role}-${phase}.png`));

export function validateRideEmergencyDevice(marker, receipt, runId, ride, loadScreenshot) {
  assert.match(runId, /^[a-f0-9]{32}$/);
  for (const key of ['rideSessionId', 'tripId']) assert(typeof ride?.[key] === 'string' && ride[key].length > 0);
  assert.equal(marker.projectId, 'demo-sgm-local-qa'); assert.equal(marker.runId, runId);
  assert.equal(marker.scope, 'local-native-active-ride-emergency-not-physical');
  assert.equal(marker.driverResumedTracking, true);
  assert.equal(marker.physicalDevice, false); assert.equal(marker.productionWrites, false);
  assert.equal(receipt.projectId, marker.projectId); assert.equal(receipt.runId, runId);
  assert.equal(receipt.scope, 'local-adb-file-sync-command-not-flow-verification');
  assert.equal(receipt.phase, 'ride-emergency'); assert.equal(receipt.completed, true);
  assert.equal(receipt.status, 0); assert.equal(receipt.signal, null); assert.equal(receipt.errorCode, null);
  assert.deepEqual(marker.actors.map((actor) => actor.role), rideEmergencyRoles);
  for (const actor of marker.actors) {
    assert.equal(actor.ownerUid, `sgm-qa-${actor.role}`);
    assert.equal(actor.rideSessionId, ride.rideSessionId); assert.equal(actor.tripId, ride.tripId);
    assert.equal(actor.returnedToSameRide, true); assert.equal(actor.passengerStatusesUnchanged, true);
    assert.equal(actor.contactChosenThroughUi, true); assert.equal(actor.foreignContactVisible, false);
    assert.equal(actor.driverControlsAvailable, actor.role === 'driver');
    assert.equal(actor.contactSavedRevision, 1); assert.equal(actor.contactRemovedRevision, 2);
    assert.equal(actor.dialIntentCount, 1); assert.equal(actor.directCallIntentCount, 0);
    assert.equal(actor.dialerNumberMatched, true);
    assert.match(actor.dialerPackage, /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/);
    assert(!actor.dialerPackage.startsWith('be.sportgreenmoove.app'));
  }
  assert.deepEqual(Object.keys(marker.screenshots).sort(), [...rideEmergencyCaptures].sort());
  for (const file of rideEmergencyCaptures) {
    const image = loadScreenshot(file);
    assert(image.length >= 24); assert.equal(image.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert(image.readUInt32BE(16) > 0 && image.readUInt32BE(20) > image.readUInt32BE(16));
    assert.equal(createHash('sha256').update(image).digest('hex'), marker.screenshots[file], file);
  }
}

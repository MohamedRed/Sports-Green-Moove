#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { projectId } from './local-emulator-config.mjs';
import { prepareLocalRuntime, runEmulatorEntry } from './local-runtime.mjs';

const runtime = prepareLocalRuntime();
try {
  runEmulatorEntry(runtime, 'local-flow-suite.mjs');
  const result = JSON.parse(readFileSync(runtime.env.SGM_LOCAL_FLOW_OUTPUT, 'utf8'));
  assert.equal(result.runId, runtime.env.SGM_LOCAL_RUN_ID, 'A fresh completed run is required');
  assert.equal(result.projectId, projectId);
  assert.equal(result.steps.length, 22);
  assert.equal(result.tripChanges?.acceptedParentCount, 2);
  assert.equal(result.tripChanges?.confirmationNotificationCount, 5);
  assert.equal(result.tripChanges?.originalTripAndBookingsPreserved, true);
  assert.equal(result.tripChanges?.applicationImplemented, false);
  assert.equal(result.tripDetails?.deniedOwnerMutations, 14);
  assert.equal(result.tripDetails?.deniedOtherActors, 3);
  assert.equal(result.tripDetails?.titleEditAllowed, true);
  assert.equal(result.tripDetails?.operationalEditingImplemented, false);
  assert.equal(result.tripCancellation?.bookingCount, 3);
  assert.equal(result.tripCancellation?.notificationCount, 2);
  assert.equal(result.tripCancellation?.seatsAfterCancellation, 3);
  assert.equal(result.tripCancellation?.races.outcomes.length, 3);
  assert(result.tripCancellation.races.outcomes.every((item) => item.consistent));
  assert.equal(result.teamOwnership?.deniedMutations, 10);
  assert.equal(result.teamOwnership?.foreignTeamUnchanged, true);
  assert.equal(result.teamOwnership?.scopedNameEditAllowed, true);
  assert.equal(result.teamOwnership?.twoClubReassignmentDenied, true);
  assert.equal(result.teamOwnership?.disabledManagerDenied, true);
  assert.equal(result.chatResponseLoss?.firstError.code, 'ECONNRESET');
  assert.equal(result.chatResponseLoss?.firstError.responseReceived, false);
  assert.equal(result.chatResponseLoss?.messageCount, 1);
  assert.equal(result.chatResponseLoss?.notificationCount, 1);
  assert.equal(result.tripCapacity?.rejectedOwnerMutations, 7);
  assert.equal(result.tripCapacity?.rejectedOtherActors, 3);
  assert.equal(result.tripCapacity?.seatsAfterApproval, 2);
  assert.equal(result.tripCapacity?.seatsAfterCancellation, 4);
  assert.equal(result.tripCapacity?.titleEditAllowed, true);
  assert.equal(result.membershipReview?.auditCount, 3);
  assert.equal(result.membershipReview?.revokedManagerRejected, true);
  assert.equal(result.reservationDecisions?.declinedSeatsAfter, 4);
  assert.equal(result.reservationDecisions?.cancellationSeatsAfter, 4);
  assert.equal(result.reservationDecisions?.activePassengerCancellationRejected, true);
  assert.equal(result.scenarios?.multiSeat?.requestedSeats, 2);
  assert.equal(result.scenarios?.multiSeat?.seatsAfterApproval, 2);
  assert.equal(result.scenarios?.multiSeat?.seatsAfterCancellation, 4);
  assert(result.steps.every((step) => step.status === 'passed'), 'Every local scenario must pass');
} finally {
  runtime.cleanup();
}

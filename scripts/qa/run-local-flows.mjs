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
  assert.equal(result.steps.length, 15);
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

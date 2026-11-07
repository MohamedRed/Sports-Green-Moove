import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve, basename } from 'node:path';
import { createHash } from 'node:crypto';
import { assertSearchBookingEvidence } from './search-booking-evidence.mjs';
import { assertInstrumentationPassed } from './android-instrumentation-result.mjs';
import { validateContinuousDeviceEvidence } from './continuous-device-evidence.mjs';
import { assertRetainedSourceFiles } from './retained-source-evidence.mjs';
import { historicalSearchBookingNoticeContract } from './search-booking-checkpoint.mjs';

export function validateRetainedSearchBooking(root, source) {
  const base = dirname(resolve(root, source)), read = name => readFileSync(resolve(base, name));
  const json = name => JSON.parse(read(name)), sha = bytes => createHash('sha256').update(bytes).digest('hex');
  assert.equal(basename(source), 'search-booking-results.json');
  const report = json('search-booking-results.json'), app = json('search-booking-app-results.json');
  const context = json('retained-context.json'), run = json('native-run.json');
  assert.equal(context.sourceCommit, '7d93569ce30c77ac0c8035dd25aea86cdcad14c4');
  assert.equal(context.workflowRunId, 39513673003); assert.equal(context.caseJobId, 118940563992);
  assert.equal(context.artifactId, 12306877088); assert.equal(context.runId, report.runId);
  assert.equal(context.scope, 'one-local-search-two-seat-booking-trial-not-complete-release');
  for (const key of ['physicalDevice', 'productionDeployed', 'paymentExercised', 'safetyAuditAccepted', 'storeReviewAccepted'])
    assert.equal(context[key], false, key);
  assert.deepEqual(context.reviewedCaptures, ['choices', 'requested', 'driver-approved', 'cancelled']
    .map(stem => `local-parent-search-booking-${stem}.png`));
  assert.equal(run.headSha, context.sourceCommit); assert.equal(run.databaseId, context.workflowRunId);
  assert.equal(run.status, 'completed'); assert.equal(run.conclusion, 'success'); assert.equal(run.event, 'workflow_dispatch');
  const job = run.jobs.find(job => job.databaseId === context.caseJobId);
  assert.equal(job.name, 'Android approved parent search and booking / parent-search-booking');
  assert.equal(job.conclusion, 'success'); assert.equal(job.status, 'completed');
  assert.equal(report.sourceCommit, context.sourceCommit); assert.equal(report.status, 'passed');
  for (const key of ['isolatedEnvironmentDestroyed', 'providerBrokerClosed', 'adminClientClosed', 'checkpointServerClosed', 'localPackagesRemoved'])
    assert.equal(report[key], true, key);
  for (const key of ['productionWrites', 'safetyAuditAccepted', 'storeReviewAccepted']) assert.equal(report[key], false, key);
  assert.equal(report.cleanupMode, 'destroy-owned-local-environment');
  assert.equal(report.emulatorEndpoints.closed, true); assert.equal(report.emulatorEndpoints.host, '127.0.0.1');
  assert.deepEqual(report.emulatorEndpoints.ports, [9099, 8080, 9000, 5001]);
  assert.deepEqual(report.fixtureIsolation, { unrelatedDocumentsUnchanged: true, allClaimsUnchanged: true, liveTripsUnchanged: true,
    ownNewBookings: 1, ownNewRequestReceipts: 1, ownNewNotifications: 2 });
  for (const [key, value] of Object.entries(app)) assert.deepEqual(report[key], value, key);
  for (const [key, value] of Object.entries(json('local-parent-search-booking-device.json'))) assert.deepEqual(report[key], value, key);
  const verification = assertSearchBookingEvidence({ native: report, checkpoints: json('search-booking-checkpoints.json'),
    provider: json('search-booking-provider.json'), runId: context.runId, tripId: report.tripId, readCapture: read,
    noticeContract: historicalSearchBookingNoticeContract });
  assert.deepEqual(report.verification, verification);
  const pull = json('adb-pull-parent-search-booking.json');
  assert.deepEqual(report.primaryCopy, pull); assert.equal(pull.completed, true); assert.equal(pull.status, 0);
  assert.equal(pull.runId, context.runId); assert.equal(pull.phase, 'parent-search-booking');
  assert.equal(pull.errorCode, null); assert.equal(pull.signal, null);
  assertInstrumentationPassed(read('LocalParentSearchBookingTest-instrumentation.txt').toString(), 1);
  assert.deepEqual(json('suite-status.json'), { scope: 'parent-search-booking-command-not-flow-proof', status: 0 });
  validateContinuousDeviceEvidence({ setup: json('disposable-device-setup.json'), setupBytes: read('disposable-device-setup.json'),
    restored: json('disposable-device-restore.json'), claimed: read('disposable-device-setup.json.claimed'), report });
  assertRetainedSourceFiles(root, report.sourceFiles);
  const artifact = json('artifact-metadata.json'); assert.equal(artifact.id, context.artifactId);
  assert.equal(artifact.name, 'android-parent-search-booking'); assert.match(artifact.digest, /^sha256:[a-f0-9]{64}$/);
  const hashes = json('artifact-sha256.json');
  assert.deepEqual(Object.keys(hashes).sort(), readdirSync(base).filter(name => !['artifact-sha256.json', 'README.md'].includes(name)).sort());
  for (const [name, expected] of Object.entries(hashes)) { assert.equal(basename(name), name); assert.equal(sha(read(name)), expected, name); }
  return report;
}

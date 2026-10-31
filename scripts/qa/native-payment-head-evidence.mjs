import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { assertInstrumentationPassed } from './android-instrumentation-result.mjs';
import { assertEvidenceBundleChecksums } from './evidence-bundle-checksums.mjs';

export function validateNativePaymentHeadRecheck(root, record) {
  const base = dirname(resolve(root, record.source)), read = file => readFileSync(resolve(base, file), 'utf8');
  const json = file => JSON.parse(read(file)), summary = json('summary.json'), run = json('native-run.json');
  assert.equal(resolve(root, record.checksums), resolve(base, 'artifact-sha256.json'));
  assert.equal(record.checkedAt, '2026-10-23'); assert.equal(summary.checkedAt, record.checkedAt);
  assert.equal(summary.scope, 'terminal-native-primary-copy-and-fused-startup-failure-not-full-replay-or-release');
  assert.equal(run.databaseId, 40023614141); assert.equal(run.status, 'completed'); assert.equal(run.conclusion, 'failure');
  assert.equal(run.headSha, 'a2f273fb45d0f5f8bd882f9f7a3ebeb49e5513a1'); assert.equal(summary.sourceCommit, run.headSha);
  for (const id of [120654144389, 120654145222]) assert.equal(run.jobs.find(job => job.databaseId === id).conclusion, 'failure');
  const cases = run.jobs.filter(job => job.name.startsWith('Android focused safety UI tests / Isolated ') && !job.name.endsWith('safety flows'));
  assert.equal(cases.length, 10); assert.equal(cases.filter(job => job.conclusion === 'success').length, 9);
  for (const [file, id] of [['main-artifact.json', 12533545511], ['startup-artifact.json', 12532292087]]) {
    const artifact = json(file); assert.equal(artifact.id, id); assert.equal(artifact.workflow_run.head_sha, run.headSha);
  }
  const ordinary = json('ordinary-results.json');
  assert.equal(ordinary.passed, 159); assert.equal(ordinary.skipped, 52); assert.equal(ordinary.failed, 0);
  assert(ordinary.cases.some(row => row.className.endsWith('.ReservationActionsUiTest') &&
    row.name === 'approvingOneBookingDoesNotDependOnOtherApprovedBookings' && row.status === 'passed'));
  assert.match(read('LocalDriverFlowTest.kt.txt'), /reservation\.status\.sgm-qa-booking-requested/);
  assertInstrumentationPassed(read('driver-batch.txt'), 9); assertInstrumentationPassed(read('trip-inputs.txt'), 1);
  const primary = json('primary-copy.json'), cleanup = json('cleanup-copy.json');
  assert.equal(primary.runId, summary.runId); assert.equal(primary.phase, 'trip-change-inputs');
  assert.equal(primary.completed, false); assert.equal(primary.status, 1);
  assert.equal(cleanup.runId, primary.runId); assert.equal(cleanup.completed, true); assert.equal(cleanup.status, 0);
  assert.match(cleanup.stderr, /100 files pulled, 0 skipped/);
  const startup = read('startup-instrumentation.txt');
  assert.match(startup, /LocalNativeTrackingStartupTest\.kt:85/);
  assert.match(startup, /Tests run: 1,\s+Failures: 1/);
  assert.match(startup, /Suppressed:.*ApiException: 20: The connection to Google Play services was lost due to service disconnection/);
  assert.match(read('startup-failure-tree.txt'), /Position GPS indisponible pour le suivi de course/);
  for (const prefix of ['main', 'startup']) {
    const restoration = json(prefix + '-restoration.json'); assert.equal(restoration.verified, true);
    for (const flag of ['authorizationRemoved', 'componentRemoved', 'originalPolicyRestored']) assert.equal(restoration.restoration.installAdmin[flag], true);
    assert.equal(restoration.restoration.localPackagesRemoved, true); assert.equal(restoration.restoration.launcher, true);
    assert.equal(json(prefix + '-host.json').finalState, 'gone'); assert.equal(json(prefix + '-host.json').targetExitObserved, true);
  }
  for (const [key, value] of Object.entries({ordinaryPassed:159,ordinarySkipped:52,ordinaryFailed:0,
    driverBatchCasesPassed:9,focusedCasesPassed:9,focusedCasesFailed:1,cleanupFilesPulled:100})) assert.equal(summary[key], value);
  for (const key of ['identityScopedApprovalExecuted', 'cleanupCopySucceeded', 'restorationVerified', 'hostExitVerified']) assert.equal(summary[key], true);
  for (const key of ['primaryCopyAccepted', 'fullReplayAccepted', 'workflowPassed', 'startupCaseAccepted',
    'rootCauseConfirmed', 'newMediaPublished', 'physicalTrackingAccepted', 'productionWrites', 'releaseComplete']) assert.equal(summary[key], false);
  assertEvidenceBundleChecksums(base); return summary;
}

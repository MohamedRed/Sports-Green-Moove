import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { assertInstrumentationPassed } from './android-instrumentation-result.mjs';
import { assertEvidenceBundleChecksums } from './evidence-bundle-checksums.mjs';

export function validateNativeCopyCe282274(root, record, blockers) {
  const base = dirname(resolve(root, record.source));
  const bytes = file => readFileSync(resolve(base, file)), json = file => JSON.parse(bytes(file));
  const summary = json('summary.json'), run = json('native-run.json');
  assert.equal(summary.checkedAt, record.checkedAt);
  assert.equal(summary.scope, 'terminal-native-copy-failure-with-passing-guardian-and-team-cases-not-release');
  assert.equal(run.databaseId, 39994935177); assert.equal(run.headSha, 'ce282274babf5812b1b0b80f5dcb0c573c5e293d');
  assert.equal(summary.sourceCommit, run.headSha); assert.equal(run.status, 'completed'); assert.equal(run.conclusion, 'failure');
  assert.equal(run.jobs.find(job => job.databaseId === 120555882904).conclusion, 'failure');
  const focused = run.jobs.filter(job => job.name.startsWith('Android focused safety UI tests / '));
  assert.equal(focused.length, 11); assert(focused.every(job => job.conclusion === 'success'));
  assert.equal(json('artifact-metadata.json').id, 12519907789);
  for (const file of ['artifact-metadata.json', 'team-artifact-metadata.json']) {
    assert.equal(json(file).workflow_run.head_sha, run.headSha); assert.equal(json(file).expired, false);
  }
  const failed = json('primary-copy.json'), recovered = json('cleanup-copy.json');
  assert.equal(failed.runId, 'a156f95da1f84aca09cc8fb1e0828878'); assert.equal(failed.phase, 'trip-change-parent-confirmation');
  assert.equal(failed.completed, false); assert.equal(failed.status, 1);
  assert.equal(recovered.runId, failed.runId); assert.equal(recovered.completed, true); assert.equal(recovered.status, 0);
  assert.match(recovered.stderr, /90 files pulled, 0 skipped/);
  assertInstrumentationPassed(bytes('guardian-instrumentation.txt').toString(), 1);
  assertInstrumentationPassed(bytes('trip-change-instrumentation.txt').toString(), 1);
  assertInstrumentationPassed(bytes('team-instrumentation.txt').toString(), 1);
  const team = json('team-results.json'); assert.equal(team.projectId, 'demo-sgm-local-qa');
  assert.equal(team.scope, 'local-native-team-conversation-with-sdk-peers-not-physical-or-push');
  assert(team.steps.every(step => step.status === 'passed'));
  const app = json('team-app-results.json'); assert.equal(app.checks.length, 9); assert(app.checks.every(step => step.status === 'passed'));
  for (const file of ['device-restoration.json', 'team-restoration.json']) {
    const restore = json(file); assert.equal(restore.verified, true);
    assert(Object.values(restore.restoration.installAdmin).every(value => value === true));
    assert.equal(restore.restoration.localPackagesRemoved, true); assert.equal(restore.restoration.launcher, true);
  }
  for (const file of ['host-observation.json', 'team-host-observation.json']) {
    assert.equal(json(file).finalState, 'gone'); assert.equal(json(file).targetExitObserved, true);
  }
  const before = json('original-fingerprint-coverage.json'); assert.equal(before.complete, false);
  assert.equal(before.requiredCount, 164); assert.equal(before.originalCount, 148); assert.equal(before.missing.length, 16);
  assert(before.missing.includes('docs/release/evidence/payout-accounting-2026-10-23/summary.json'));
  for (const key of ['guardianCasePassed', 'teamCasePassed', 'deviceRestorationVerified', 'hostExitVerified']) assert.equal(summary[key], true);
  for (const key of ['fullCiPassed', 'earlierLoginRootCauseConfirmed', 'copyRootCauseConfirmed', 'newMediaAccepted',
    'physicalTrackingAccepted', 'realPaymentExercised', 'productionWrites', 'releaseComplete']) assert.equal(summary[key], false);
  const blocker = blockers.find(row => row.id === 'native-evidence-copy');
  assert(blocker?.source?.startsWith('docs/release/evidence/'), 'A current copy blocker must remain; its newer source is validated separately');
  assert.equal(blockers.find(row => row.id === 'native-login-replay'), undefined);
  assertEvidenceBundleChecksums(base);
  return summary;
}

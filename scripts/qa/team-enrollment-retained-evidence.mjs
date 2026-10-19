import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { assertInstrumentationPassed } from './android-instrumentation-result.mjs';
import { teamNativeChecks, validateTeamNativeDevice } from './team-native-evidence.mjs';

export function validateRetainedTeamEnrollment(root, path) {
  const directory = dirname(resolve(root, path));
  const load = (name) => readFileSync(resolve(directory, name));
  const run = JSON.parse(readFileSync(resolve(root, path), 'utf8'));
  validateTeamEnrollmentReport(run);
  const marker = JSON.parse(load('team-enrollment-device.json'));
  const receipt = JSON.parse(load('adb-pull-team-enrollment.json'));
  validateTeamNativeDevice(marker, receipt, run.runId, load);
  assert.deepEqual(run.checks, marker.checks); assert.deepEqual(run.screenshots, marker.screenshots);
  const transcript = load('LocalTeamEnrollmentFlowTest-instrumentation.txt');
  const hash = (raw) => createHash('sha256').update(raw).digest('hex');
  assertInstrumentationPassed(transcript.toString('utf8'), 1);
  assert.match(transcript.toString('utf8'), /sgm_installations_blocked=true/);
  assert.equal(hash(transcript), run.transcriptSha256);
  assert.equal(Object.keys(run.sourceFiles).length, 20);
  for (const [file, expected] of Object.entries(run.sourceFiles))
    assert.equal(hash(readFileSync(resolve(root, file))), expected, file);
  const artifacts = JSON.parse(load('artifact-sha256.json'));
  assert.equal(Object.keys(artifacts).length, 9);
  for (const [file, expected] of Object.entries(artifacts)) assert.equal(hash(load(file)), expected, file);
  return run;
}

export function validateTeamEnrollmentReport(run) {
  assert.equal(run.projectId, 'demo-sgm-local-qa'); assert.equal(run.scope, 'local-ui-not-physical-device');
  assert.match(run.runId, /^[a-f0-9]{32}$/); assert.equal(run.testCount, 1); assert.equal(run.nativeCaseCount, 1);
  assert.deepEqual(run.steps, [{ id: 'team-enrollment-ui', status: 'passed' }]);
  assert.deepEqual(run.checks, teamNativeChecks.map((id) => ({ id, status: 'passed' })));
  assert.equal(run.guardianVerificationPreseeded, false);
  assert.equal(run.managerDecisionMethod, 'authenticated-local-sdk-not-management-ui');
  assert.equal(run.enrollmentCount, 2); assert.equal(run.enrollmentEventCount, 8); assert.equal(run.guardianEventCount, 3);
  assert.equal(run.protectedRecordsUnchanged, true); assert.equal(run.isolatedFixtureCleanupVerified, true);
  for (const field of ['physicalDevice', 'productionWrites', 'fullProcessRestartProven', 'teamChatImplemented'])
    assert.equal(run[field], false, field);
}

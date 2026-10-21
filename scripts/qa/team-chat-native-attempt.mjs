import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { assertRetainedSourceFiles } from './retained-source-evidence.mjs';

export function validateTeamChatNativeAttempt(root, source) {
  const base = dirname(resolve(root, source)), read = file => readFileSync(resolve(base, file));
  const json = file => JSON.parse(read(file)); const run = json(basename(source));
  assert.equal(run.scope, 'local-team-conversation-startup-anr-not-completed-flow');
  assert.equal(run.projectId, 'demo-sgm-local-qa'); assert.match(run.runId, /^[a-f0-9]{32}$/);
  for (const key of ['nativeSuiteCompleted', 'physicalDevice', 'productionWrites', 'notificationsVerified',
    'fullProcessRestartProven', 'externalSdkTrafficVerified']) assert.equal(run[key], false, key);
  assert.deepEqual(run.flowCheckpointsVerified, []); assert.deepEqual(run.reviewedNewScreenshots, []);
  assert.equal(run.isolatedEnvironmentDestroyed, true); assert.equal(run.disposableDeviceDestroyed, true);
  assert.deepEqual(run.emulatorEndpoints, { host: '127.0.0.1', ports: [9099, 8080, 9000, 5001], closed: true });
  assertRetainedSourceFiles(root, run.sourceFiles);
  const diagnostic = json('LocalTeamConversationFlowTest-diagnostics.json');
  assert.equal(diagnostic.runId, run.runId); assert.equal(diagnostic.recordedAt, run.testedAt);
  assert.match(read('LocalTeamConversationFlowTest-instrumentation.txt').toString(), /shortMsg=Process crashed/);
  assert(!read('LocalTeamConversationFlowTest-instrumentation.txt').toString().includes('OK ('));
  assert.match(read('LocalTeamConversationFlowTest-exit-info.txt').toString(), /reason=6 \(ANR\)/);
  assert.match(read('LocalTeamConversationFlowTest-exit-info.txt').toString(), /failed to complete startup/);
  assert.equal(read('LocalTeamConversationFlowTest-crash.txt').toString().trim(), '');
  const restore = json('disposable-device-restore.json');
  assert.equal(restore.case, 'team-conversation'); assert.equal(restore.restored, true); assert.equal(restore.verified, false);
  assert.equal(restore.observed.continuousGuardVerified, false);
  for (const key of ['localPackagesRemoved', 'background', 'stopped', 'launcher']) assert.equal(restore.restoration[key], true);
  for (const key of ['authorizationRemoved', 'componentRemoved', 'originalPolicyRestored']) assert.equal(restore.restoration.installAdmin[key], true);
  const setup = json('disposable-device-setup.json');
  assert.equal(setup.case, 'team-conversation'); assert.equal(setup.scope, 'single-case-continuous-installation-guard-not-flow-proof');
  assert.equal(json('team-conversation-suite-status.json').status, 1);
  assert.equal(json('preflight-failed.json').stage, 'read-only-preflight');
  for (const [file, expected] of Object.entries(json('artifact-sha256.json'))) {
    assert.equal(basename(file), file); assert.equal(createHash('sha256').update(read(file)).digest('hex'), expected, file);
  }
  return run;
}

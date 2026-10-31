import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

// Dated evidence must not acquire new requirements from today's CI matrix.
const focusedCases = ['emergency-identity', 'ride-observation', 'native-startup', 'remote-ride-stop',
  'session-restoration', 'session-disconnect', 'team-conversation', 'team-access', 'team-draft', 'team-read-components'];

export function validateNativeBootRecheck(root, record) {
  const base = dirname(resolve(root, record.source)), bytes = name => readFileSync(resolve(base, name));
  const json = name => JSON.parse(bytes(name)), report = json('summary.json'), run = json('native-run.json');
  assert.equal(resolve(root, record.checksums), resolve(base, 'artifact-sha256.json'));
  assert.equal(report.checkedAt, record.checkedAt);
  assert.equal(report.scope, 'terminal-boot-failure-and-focused-cleanup-observations-not-full-matrix-proof');
  assert.equal(report.sourceCommit, 'bea9e0eee215b2b7b531b923c6dc81816e6ef964');
  assert.equal(run.headSha, report.sourceCommit); assert.equal(run.databaseId, report.runId); assert.equal(run.databaseId, 39865744186);
  assert.equal(run.status, 'completed'); assert.equal(run.conclusion, 'failure');
  const full = run.jobs.find(job => job.databaseId === report.matrixJobId);
  assert.equal(full.name, 'Android native UI tests'); assert.equal(full.conclusion, 'failure');
  assert.equal(full.steps.find(step => step.name === 'Compile app and tests before starting the disposable device').conclusion, 'success');
  assert.equal(full.steps.find(step => step.name === 'Run Android Compose UI tests').conclusion, 'failure');
  const log = bytes('native-job.log').toString();
  assert.match(log, /shell input keyevent 82/); assert.match(log, /adb' failed with exit code 255/);
  assert(!log.includes('Ordinary tests:')); assert(!log.includes('##[group]Run bash scripts/run-android-ui-tests'));
  let gone = 0, zombie = 0;
  for (const name of focusedCases) {
    assert.equal(run.jobs.find(job => job.name === 'Android focused safety UI tests / Isolated ' + name).conclusion, 'success');
    const restore = json(`focused/${name}-restore.json`), host = json(`focused/${name}-host.json`);
    assert.equal(restore.scope, 'single-case-device-restoration-not-flow-proof'); assert.equal(restore.case, name);
    assert.equal(restore.restored, true); assert.equal(restore.verified, true); assert.equal(restore.observed.continuousGuardVerified, true);
    for (const key of ['localPackagesRemoved', 'background', 'stopped', 'launcher']) assert.equal(restore.restoration[key], true);
    for (const key of ['authorizationRemoved', 'componentRemoved', 'originalPolicyRestored']) assert.equal(restore.restoration.installAdmin[key], true);
    assert.equal(host.scope, 'ci-read-only-emulator-host-observation-not-flow-or-root-cause-proof'); assert.equal(host.phase, name);
    for (const key of ['processSignalsRequested', 'deviceCommandsRequested', 'flowAccepted', 'rootCauseConfirmed']) assert.equal(host[key], false);
    assert.equal(host.finalState, name === 'native-startup' ? 'zombie' : 'gone');
    assert.equal(host.targetExitObserved, host.finalState === 'gone');
    if (host.finalState === 'gone') gone++; else zombie++;
  }
  assert.equal(run.jobs.find(job => job.name === 'Android focused safety UI tests / Isolated safety flows').conclusion, 'success');
  assert.equal(report.focusedCasesPassed, 10); assert.equal(report.focusedRestorationsVerified, 10);
  assert.equal(report.focusedHostGone, gone); assert.equal(report.focusedHostZombie, zombie);
  assert.equal(report.fullMatrixCompiled, true);
  for (const key of ['matrixExecuted', 'fullCiPassed', 'rootCauseConfirmed', 'earlierTransportFailureExplained',
    'allHostProcessesGone', 'physicalDeviceAccepted', 'releaseComplete']) assert.equal(report[key], false);
  assert.deepEqual(report.newCapturesAccepted, []);
  const hashes = json('artifact-sha256.json');
  assert.deepEqual(Object.keys(hashes).sort(), ['README.md', 'native-run.json', 'native-job.log', 'summary.json',
    ...focusedCases.flatMap(name => [`focused/${name}-restore.json`, `focused/${name}-host.json`])].sort());
  for (const [file, hash] of Object.entries(hashes)) {
    assert(/^(?:focused\/[a-z-]+-(?:restore|host)\.json|native-(?:run\.json|job\.log)|summary\.json|README\.md)$/.test(file));
    assert.match(hash, /^[a-f0-9]{64}$/); assert.equal(createHash('sha256').update(bytes(file)).digest('hex'), hash, file);
  }
  return report;
}

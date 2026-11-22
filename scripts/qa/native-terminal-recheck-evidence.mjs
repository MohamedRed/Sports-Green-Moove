import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export function validateNativeTerminalRecheck(root, record) {
  const base = dirname(resolve(root, record.source));
  const read = name => readFileSync(resolve(base, name));
  const json = name => JSON.parse(read(name));
  assert.equal(resolve(root, record.checksums), resolve(base, 'artifact-sha256.json'));
  const report = json('summary.json'), run = json('native-run.json');
  assert.equal(report.checkedAt, record.checkedAt);
  assert.equal(report.scope, 'completed-local-matrix-with-focused-job-cancelled-after-emulator-shutdown-command');
  assert.equal(report.sourceCommit, 'a6d8a6304ef8c104fa72172263a1804280227a08');
  assert.equal(run.headSha, report.sourceCommit); assert.equal(run.databaseId, report.nativeRunId);
  assert.equal(run.status, 'completed'); assert.equal(run.conclusion, 'cancelled');
  const matrix = run.jobs.find(job => job.databaseId === report.matrixJobId);
  const focused = run.jobs.find(job => job.databaseId === report.focusedJobId);
  assert.equal(matrix.name, 'Android native UI tests'); assert.equal(matrix.conclusion, 'success');
  assert.equal(focused.name, 'Android focused safety UI tests / Isolated ride-observation');
  assert.equal(focused.conclusion, 'cancelled');
  assert.equal(focused.steps.find(step => step.name === 'Run one isolated safety flow on its own phone').conclusion, 'cancelled');
  assert.deepEqual(json('native-suite-status.json'), { scope: 'native-suite-exit-status-not-flow-verification',
    ordinaryTests: 0, componentEvidence: 0, localReplay: 0 });
  const replay = json('replay-results.json'); assert.equal(replay.runId, report.matrixRunId);
  assert.equal(replay.scope, 'local-ui-not-physical-device'); assert.equal(replay.testCount, 36);
  assert.equal(replay.nativeCaseCount, 38); assert.equal(replay.steps.length, 36);
  assert(replay.steps.every(step => step.status === 'passed')); assert.equal(report.localFlowGroupsPassed, 36);
  assert.equal(report.nativeReplayCasesPassed, 38);
  const copies = readdirSync(resolve(base, 'copies')).sort(); assert.equal(copies.length, 16);
  assert.equal(report.primaryCopiesPassed, copies.length);
  for (const file of copies) {
    assert.match(file, /^adb-pull-[a-z-]+\.json$/); const receipt = json('copies/' + file);
    assert.equal(receipt.phase, file.slice('adb-pull-'.length, -'.json'.length));
    assert.equal(receipt.runId, replay.runId); assert.equal(receipt.completed, true); assert.equal(receipt.status, 0);
    assert.equal(receipt.signal, null); assert.equal(receipt.errorCode, null);
  }
  const trial = json('focused-results.json'); assert.equal(trial.runId, report.focusedRunId);
  assert.equal(trial.scope, 'local-ride-live-sdk-not-physical-gps'); assert.equal(trial.testCount, 1);
  for (const key of ['adminClientClosed', 'localPackagesRemoved', 'isolatedFixtureCleanupVerified']) assert.equal(trial[key], true);
  assert.equal(trial.physicalDevice, false); assert.equal(trial.providerTrackingVerified, false);
  assert.equal(json('focused-suite-status.json').status, 0);
  for (const file of ['matrix-device-restore.json', 'focused-device-restore.json']) {
    const restored = json(file); assert.equal(restored.verified, true); assert.equal(restored.restored, true);
    const admin = file === 'matrix-device-restore.json' ? restored.installAdmin : restored.restoration.installAdmin;
    for (const key of ['authorizationRemoved', 'componentRemoved', 'originalPolicyRestored']) assert.equal(admin[key], true);
  }
  const log = read('focused-shutdown-excerpts.txt').toString();
  assert.match(log, /21:41:35.*Script exited successfully \(code 0\)/);
  assert.match(log, /21:41:37.*OK: killing emulator/); assert.match(log, /21:56:51.*operation was canceled/);
  for (const key of ['matrixJobPassed', 'focusedAppCasePassed', 'fixtureAndPolicyRestorationVerified']) assert.equal(report[key], true);
  for (const key of ['fullCiPassed', 'focusedJobPassed', 'emulatorProcessExitVerified', 'earlierTransportFailureExplained',
    'rootCauseConfirmed', 'physicalDeviceAccepted', 'safetyAuditAccepted', 'releaseComplete', 'productionWrites']) assert.equal(report[key], false);
  assert.deepEqual(report.newCapturesPublished, []);
  const artifacts = json('artifact-inventory.json'); assert.equal(artifacts.length, 2);
  assert.deepEqual(artifacts.map(item => item.id).sort(), [12461492995, 12462141571]);
  for (const artifact of artifacts) {
    assert.equal(artifact.workflow_run.head_sha, run.headSha); assert.equal(artifact.workflow_run.id, run.databaseId);
    assert.match(artifact.digest, /^sha256:[a-f0-9]{64}$/);
  }
  const hashes = json('artifact-sha256.json');
  for (const file of ['summary.json', 'native-run.json', 'replay-results.json', 'focused-results.json',
    'native-suite-status.json', 'matrix-device-restore.json', 'focused-device-restore.json', 'focused-suite-status.json',
    'focused-shutdown-excerpts.txt', 'artifact-inventory.json', ...copies.map(name => 'copies/' + name)]) assert(Object.hasOwn(hashes, file));
  for (const [file, hash] of Object.entries(hashes)) {
    assert(!file.includes('..') && !file.startsWith('/'));
    assert.equal(createHash('sha256').update(read(file)).digest('hex'), hash, file);
  }
  return report;
}

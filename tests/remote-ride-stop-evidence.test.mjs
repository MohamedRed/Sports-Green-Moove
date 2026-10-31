import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateRemoteRideStopReport, validateRetainedRemoteRideStop } from '../scripts/qa/remote-ride-stop-evidence.mjs';
import { assertRetainedSourceFiles } from '../scripts/qa/retained-source-evidence.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
const base = 'docs/release/evidence/remote-ride-stop-pass-2026-10-19/';
const json = (path) => JSON.parse(readFileSync(resolve(root, path)));
test('the completed independent native case proves background stop and disposable environment cleanup only', () => {
  const report = validateRetainedRemoteRideStop(root, base + 'remote-ride-stop-results.json');
  assert.equal(report.physicalBackgroundGpsVerified, false); assert.equal(report.backgroundStopBeforeResume, true);
});
test('missing cleanup, changed identities and invented physical proof are rejected', () => {
  const original = json(base + 'remote-ride-stop-results.json');
  for (const patch of [{ backgroundStopBeforeResume: false }, { driverStillSignedInAtStop: false },
    { isolatedEnvironmentDestroyed: false }, { emulatorCliExitedSuccessfully: false },
    { rideSessionId: '' }, { bookingId: 'wrong' }, { childId: 'other-child' },
    { physicalBackgroundGpsVerified: true }, { nativeCaseCount: 0 }, { steps: [] },
    { isolation: { ...original.isolation, baselineRecordsPreserved: false } },
    { isolation: { ...original.isolation, createdRecordCounts: { ...original.isolation.createdRecordCounts, rewardLedger: 1 } } }])
    assert.throws(() => validateRemoteRideStopReport({ ...original, ...patch }));
});
test('the original service-stop timeout remains an immutable negative case', () => {
  const directory = 'docs/release/evidence/remote-ride-stop-before-2026-10-19/';
  const checkpoint = json(directory + 'local-remote-ride-stop-checkpoint.json');
  assert.equal(checkpoint.appBackgrounded, true); assert.equal(checkpoint.peerCompletionAcknowledged, true);
  assert.equal(checkpoint.serviceRunningImmediatelyAfterCompletion, true);
  const transcript = readFileSync(resolve(root, directory + 'LocalRemoteRideStopFlowTest-instrumentation.txt'), 'utf8');
  assert.match(transcript, /Condition still not satisfied after 20000 ms/); assert.match(transcript, /Failures: 1/);
  assert(!existsSync(resolve(root, directory + 'remote-ride-stop-results.json')));
  assert(!existsSync(resolve(root, directory + 'local-remote-ride-stop-device.json')));
  assertRetainedSourceFiles(root, json(directory + 'source-hashes.json'));
  for (const [name, hash] of Object.entries(json(directory + 'artifact-sha256.json')))
    assert.equal(createHash('sha256').update(readFileSync(resolve(root, directory + name))).digest('hex'), hash);
});
test('the failed Home injection is not promoted to a successful completion', () => {
  const directory = 'docs/release/evidence/remote-ride-stop-input-failure-2026-10-19/';
  const transcript = readFileSync(resolve(root, directory + 'LocalRemoteRideStopFlowTest-instrumentation.txt'), 'utf8');
  assert.match(transcript, /LocalRemoteRideStopFlowTest.kt:57/); assert.match(transcript, /Failures: 1/);
  assert(!existsSync(resolve(root, directory + 'local-remote-ride-stop-device.json')));
});
test('the successful stop checkpoint does not hide the failed task-return assertion', () => {
  const directory = 'docs/release/evidence/remote-ride-stop-resume-failure-2026-10-19/';
  const checkpoint = json(directory + 'local-remote-ride-stop-checkpoint.json');
  assert.equal(checkpoint.appBackgrounded, true); assert.equal(checkpoint.serviceRunningImmediatelyAfterCompletion, false);
  assert.equal(json(directory + 'remote-ride-stop-isolation.json').baselineRecordsPreserved, true);
  const transcript = readFileSync(resolve(root, directory + 'LocalRemoteRideStopFlowTest-instrumentation.txt'), 'utf8');
  assert.match(transcript, /Activity never becomes requested state/); assert.match(transcript, /Failures: 1/);
  assert(!existsSync(resolve(root, directory + 'local-remote-ride-stop-device.json')));
});
test('the new local pass cannot replace the terminal remote CI failures or historical startup ANR', () => {
  const checks = json('docs/release/evidence/ci-d2b00e7-2026-10-19/checks.json');
  assert.equal(checks.headRefOid, 'd2b00e706cdf252392842ba01e98309f398c5321');
  for (const name of ['Android native UI tests', 'Functions, admin, and website smoke']) {
    const check = checks.statusCheckRollup.find((item) => item.name === name);
    assert.equal(check.status, 'COMPLETED'); assert.equal(check.conclusion, 'FAILURE');
  }
  const readme = readFileSync(resolve(root, 'docs/release/evidence/ci-d2b00e7-2026-10-19/README.md'), 'utf8');
  assert.match(readme, /native-startup-replay-anr-2026-10-19/);
});

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { imageSize } from 'image-size';
import { assertIsolatedTunnelSettings } from './browserstack-local-policy.mjs';
import { teamPhonePhases, verifyManualTeamCheckpoint } from './manual-team-phone-checkpoints.mjs';
import { assertRetainedSourceFiles } from './retained-source-evidence.mjs';

export const teamPhoneScope = 'physical-android-team-parent-and-management-ui-with-isolated-services';
export const teamPhoneCaptures = [...teamPhonePhases.map(([phase]) => `phone-${phase}.jpg`),
  'manager-self-requested.jpg', 'manager-self-approved.jpg', 'manager-self-withdrawn.jpg',
  'manager-child-confirmation.jpg', 'manager-child-approved.jpg'];

export function assertTeamPhoneReport(run, session, checkpoints, connection, teardown) {
  assert.equal(run.scope, teamPhoneScope); assert.equal(run.method, 'manual-two-interface-ui-with-independent-persisted-checkpoints');
  assert.equal(run.projectId, 'demo-sgm-local-qa'); assert.match(run.runId, /^[a-f0-9]{32}$/);
  assert.match(run.sourceCommit, /^[a-f0-9]{40}$/); assert.match(run.appSha256, /^[a-f0-9]{64}$/);
  assert.deepEqual(run.device, { model: 'Google Pixel 8', os: 'Android 14' });
  assert.equal(run.physicalDevice, true); assert.equal(run.managerUiProven, true); assert.equal(run.parentNativeUiProven, true);
  assert.equal(run.captureMethod, 'browser-viewport-device-rectangle-not-native-pixel-export');
  assert.deepEqual(run.phoneCaptureRectangle, { x: 614, y: 112, width: 274, height: 610 });
  assert.deepEqual(run.captures, teamPhoneCaptures);
  assert.deepEqual(run.steps, teamPhonePhases.map(([phase]) => ({ id: phase, status: 'passed' })));
  for (const flag of ['productionWrites', 'fullProcessRestartProven', 'guardianRevocationPhoneProven', 'teamChatImplemented',
    'trackingVerified', 'paymentExercised', 'twoPhoneFlowVerified', 'videoCaptured', 'releaseEvidenceAccepted'])
    assert.equal(run[flag], false, flag);
  assert.equal(run.guardianPreparation, 'two-authenticated-isolated-fixture-transitions-not-management-ui');
  assert.equal(session.scope, 'manual-team-persisted-checkpoints-not-ui-or-release-proof');
  assert.equal(session.projectId, run.projectId); assert.equal(session.runId, run.runId);
  assert.equal(session.testedAt, run.testedAt); assert.equal(session.completed, true);
  assert.equal(session.fixtureCleanupVerified, true); assert.equal(session.productionWrites, false);
  assert.equal(session.physicalUiProvenByThisReport, false); assert.equal(session.teamChatImplemented, false);
  assert.equal(checkpoints.length, 7); assert.equal(session.checkpoints.length, 7);
  let previousTime = Date.parse(connection.recordedAt), identity;
  assert(Number.isFinite(previousTime)); assertIsolatedTunnelSettings(connection.settings);
  for (const [index, checkpoint] of checkpoints.entries()) {
    assert.equal(checkpoint.scope, 'independent-local-persisted-team-checkpoint-not-ui-or-release-proof');
    assert.equal(checkpoint.projectId, run.projectId); assert.equal(checkpoint.runId, run.runId);
    if (identity) assert.deepEqual(checkpoint.identity, identity); else identity = checkpoint.identity;
    assert.equal(checkpoint.phase, teamPhonePhases[index][0]);
    const expected = verifyManualTeamCheckpoint(checkpoint.phase, checkpoint.state, identity);
    assert.deepEqual(session.checkpoints[index], expected);
    const time = Date.parse(checkpoint.recordedAt); assert(Number.isFinite(time) && time >= previousTime);
    assert(time <= Date.parse(run.testedAt)); previousTime = time;
  }
  assert.equal(teardown.scope, 'observed-team-phone-test-resource-cleanup-not-release-proof');
  assert.deepEqual(teardown.loopbackPortsRefused, [5001, 8080, 9000, 9099, 5181]);
  assert(Date.parse(teardown.recordedAt) >= Date.parse(run.testedAt));
  for (const flag of ['privateSessionFileRemoved', 'fixtureCleanupVerified', 'phoneReleasedObserved',
    'tunnelDisconnectedObserved', 'helperProcessesStopped', 'clipboardRestoredObserved']) assert.equal(teardown[flag], true, flag);
}

export function validateTeamPhoneArtifacts(root, source) {
  const base = dirname(resolve(root, source)), bytes = (name) => readFileSync(resolve(base, name));
  const json = (name) => JSON.parse(bytes(name));
  const run = JSON.parse(readFileSync(resolve(root, source))), session = json('session-results.json');
  const receipts = teamPhonePhases.map(([phase]) => `${phase}.json`);
  assertTeamPhoneReport(run, session, receipts.map(json), json('connection-policy.json'), json('teardown.json'));
  const hash = (raw) => createHash('sha256').update(raw).digest('hex');
  assert.equal(Object.keys(session.sourceFiles).length, 12);
  assertRetainedSourceFiles(root, session.sourceFiles);
  const hashes = json('artifact-sha256.json'); assert.equal(Object.keys(hashes).length, 25);
  for (const [file, expected] of Object.entries(hashes)) {
    assert(!/[\\/]/.test(file)); assert.equal(hash(bytes(file)), expected, file);
  }
  for (const file of ['results.json', 'session-results.json', 'connection-policy.json', 'teardown.json',
    'phone-session-released.jpg', 'initial-stdin-close-session.json', ...receipts, ...teamPhoneCaptures]) assert(Object.hasOwn(hashes, file), file);
  const initial = json('initial-stdin-close-session.json'); assert.equal(initial.completed, false);
  assert.equal(initial.checkpoints.length, 0); assert.equal(initial.fixtureCleanupVerified, true);
  for (const file of teamPhoneCaptures) {
    const dimensions = imageSize(bytes(file)); assert.equal(dimensions.type, 'jpg');
    if (file.startsWith('phone-')) { assert.equal(dimensions.width, 274); assert.equal(dimensions.height, 610); }
    else { assert.equal(dimensions.width, 1280); assert(dimensions.height >= 780); }
  }
  return run;
}

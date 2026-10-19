import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { imageSize } from 'image-size';
import { assertRetainedSourceFiles } from '../scripts/qa/retained-source-evidence.mjs';
import { assertIsolatedTunnelSettings } from '../scripts/qa/browserstack-local-policy.mjs';
import { historyPhonePhases, verifyHistoryPhoneCheckpoint } from '../scripts/qa/manual-team-history-checkpoints.mjs';

export const teamHistoryPhoneScope = 'physical-android-owned-team-history-with-isolated-services';
export function assertHistoryPhoneReport(run, session, checkpoints, captures, teardown) {
  assert.equal(run.scope, teamHistoryPhoneScope); assert.equal(run.projectId, 'demo-sgm-local-qa');
  assert.equal(run.method, 'manual-native-ui-with-independent-persisted-checkpoints');
  assert.equal(run.managerDecisions, 'isolated-fixture-preparation-through-sdk-not-manager-ui');
  assert.equal(run.captureMethod, 'device-only-crops-from-unchanged-browser-context-images-not-native-pixel-export');
  assert.match(run.runId, /^[a-f0-9]{32}$/); assert.match(run.sourceCommit, /^[a-f0-9]{40}$/);
  assert.match(run.appSha256, /^[a-f0-9]{64}$/);
  for (const flag of ['physicalDevice', 'nativeUiObserved', 'guardianLossReadOnlyObserved',
    'confirmationCancelledWithoutWrite', 'leftAndReopenedScreen', 'explicitRefreshObserved']) assert.equal(run[flag], true, flag);
  for (const flag of ['fullProcessRestartProven', 'managerUiProvenByThisRun', 'guardianRevocationThroughUiProven',
    'teamChatImplemented', 'trackingVerified', 'paymentExercised', 'twoPhoneFlowVerified', 'videoCaptured',
    'productionWrites', 'releaseEvidenceAccepted']) assert.equal(run[flag], false, flag);
  assert.equal(session.scope, 'manual-history-persisted-checkpoints-not-ui-or-release-proof');
  assert.equal(session.runId, run.runId); assert.equal(session.projectId, run.projectId);
  assert.equal(session.testedAt, run.testedAt); assert.equal(session.completed, true);
  assert.equal(session.fixtureCleanupVerified, true); assert.equal(session.physicalUiProvenByThisReport, false);
  assert.equal(session.productionWrites, false); assert.equal(session.teamChatImplemented, false);
  assert.equal(captures.runId, run.runId); assert.equal(captures.sourceCommit, run.sourceCommit);
  for (const flag of ['videoRecorded', 'fullProcessRestartTested', 'productionWrites']) assert.equal(captures[flag], false);
  assertIsolatedTunnelSettings(captures.tunnelPolicy);
  assert.deepEqual(run.steps, historyPhonePhases.map((id) => ({ id, status: 'passed' })));
  assert.equal(checkpoints.length, 5); assert.equal(session.checkpoints.length, 5);
  let previous = 0, identity;
  checkpoints.forEach((checkpoint, index) => {
    assert.equal(checkpoint.runId, run.runId); assert.equal(checkpoint.projectId, run.projectId);
    assert.equal(checkpoint.phase, historyPhonePhases[index]);
    assert.equal(checkpoint.scope, 'independent-local-history-checkpoint-not-ui-proof');
    if (identity) assert.deepEqual(checkpoint.identity, identity); else identity = checkpoint.identity;
    assert.deepEqual(session.checkpoints[index], verifyHistoryPhoneCheckpoint(checkpoint.phase, checkpoint.state, identity));
    const time = Date.parse(checkpoint.recordedAt); assert(time >= previous && time <= Date.parse(run.testedAt)); previous = time;
  });
  assert.equal(captures.captures.length, 12); assert.equal(run.captures.length, 12);
  assert.deepEqual(run.captures, captures.captures.map((item) => item.name + '.png'));
  assert.deepEqual(run.phoneCaptureRectangle, { x: 613, y: 111, width: 275, height: 610 });
  for (const capture of captures.captures) {
    assert.match(capture.name, /^history-[a-z0-9-]+$/); assert.equal(capture.originalContextRetained, true);
    assert.deepEqual(capture.deviceCrop, run.phoneCaptureRectangle);
    assert(Date.parse(capture.capturedAt) <= Date.parse(run.testedAt));
  }
  assert(Date.parse(teardown.recordedAt) >= Date.parse(run.testedAt));
  assert.equal(teardown.scope, 'observed-owned-history-phone-resource-cleanup-not-release-proof');
  assert.deepEqual(teardown.loopbackPortsRefused, [5001, 8080, 9000, 9099, 45454]);
  for (const flag of ['fixtureCleanupVerified', 'phoneReleasedObserved', 'tunnelDisconnectedObserved', 'helperProcessesStopped',
    'privateSessionFileRemoved', 'temporaryRuntimeRemoved', 'clipboardRestoredObserved']) assert.equal(teardown[flag], true, flag);
}
export function validateHistoryPhoneArtifacts(root, source) {
  const base = dirname(resolve(root, source)), bytes = (file) => readFileSync(resolve(base, file));
  const json = (file) => JSON.parse(bytes(file));
  const run = JSON.parse(readFileSync(resolve(root, source))), session = json('session-results.json'), captures = json('captures.json');
  assertHistoryPhoneReport(run, session, historyPhonePhases.map((phase) => json(phase + '.json')), captures, json('teardown.json'));
  assert.equal(Object.keys(session.sourceFiles).length, 9); assertRetainedSourceFiles(root, session.sourceFiles);
  const hashes = json('artifact-sha256.json');
  for (const [file, expected] of Object.entries(hashes)) {
    assert(!/[\\/]/.test(file)); assert.equal(createHash('sha256').update(bytes(file)).digest('hex'), expected, file);
  }
  for (const file of ['results.json', 'session-results.json', 'captures.json', 'teardown.json',
    ...historyPhonePhases.map((phase) => phase + '.json'), ...run.captures,
    ...captures.captures.map((capture) => capture.name + '-context.jpg')]) assert(Object.hasOwn(hashes, file), file);
  for (const file of run.captures) {
    const size = imageSize(bytes(file)); assert.equal(size.type, 'png'); assert.equal(size.width, 275); assert.equal(size.height, 610);
  }
  for (const capture of captures.captures) {
    const size = imageSize(bytes(capture.name + '-context.jpg'));
    assert.equal(size.type, 'jpg'); assert.equal(size.width, 1440); assert.equal(size.height, 778);
  }
  return run;
}

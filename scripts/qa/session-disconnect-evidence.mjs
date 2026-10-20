import assert from 'node:assert/strict';

export const sessionDisconnectScope = 'local-session-disconnect-process-restart-not-physical-network-loss';
export const sessionDisconnectCaptures = ['error', 'signed-out', 'reopened'].map(id => `local-session-disconnect-${id}.png`);
export function assertSessionDisconnectBefore(before, runId) {
  assert.equal(before.scope, sessionDisconnectScope + '-checkpoint');
  assert.equal(before.projectId, 'demo-sgm-local-qa'); assert.equal(before.runId, runId);
  assert.equal(before.uidBefore, 'sgm-qa-parent'); assert.equal(before.physicalDevice, false);
  for (const key of ['initialFailureVisible', 'noImplicitDisconnect', 'explicitDisconnectReachedSignIn',
    'authEmptyAfterDisconnect']) assert.equal(before[key], true, key);
  assert(Number.isSafeInteger(before.processId) && before.processId > 0);
  assert.deepEqual(Object.keys(before.screenshots).sort(), sessionDisconnectCaptures.slice(0, 2).sort());
}
export function assertSessionDisconnectStage(before, stopped, after, proxy, runId) {
  assertSessionDisconnectBefore(before, runId);
  assert.match(runId, /^[a-f0-9]{32}$/);
  assert.equal(stopped.scope, 'disposable-local-app-force-stop');
  assert.equal(stopped.projectId, before.projectId); assert.equal(stopped.runId, runId);
  assert.equal(stopped.appId, 'be.sportgreenmoove.app.local');
  assert.equal(stopped.preparedProcessId, before.processId);
  assert(stopped.observedBeforePid === null || stopped.observedBeforePid === before.processId);
  assert.equal(stopped.forceStopIssued, true); assert.equal(stopped.noProcessAfterStop, true);
  assert.equal(after.scope, sessionDisconnectScope); assert.equal(after.projectId, before.projectId);
  assert.equal(after.runId, runId); assert.equal(after.preparedProcessId, before.processId);
  assert(Number.isSafeInteger(after.processId) && after.processId > 0 && after.processId !== before.processId);
  for (const key of ['authEmptyBeforeLaunch', 'signedOutScreenAfterProcessRestart', 'authEmptyAfterLaunch',
    'firestoreClientTerminated', 'completed']) assert.equal(after[key], true, key);
  assert.equal(after.physicalDevice, false); assert.equal(after.realNetworkLossVerified, false);
  assert.deepEqual(Object.keys(after.screenshots).sort(), [...sessionDisconnectCaptures].sort());
  for (const [file, hash] of Object.entries(before.screenshots)) assert.equal(after.screenshots[file], hash);
  for (const hash of Object.values(after.screenshots)) assert.match(hash, /^[a-f0-9]{64}$/);
  assert.equal(proxy.scope, 'local-session-restoration-controlled-callable-rejection-not-network-loss');
  assert.equal(proxy.projectId, before.projectId); assert.equal(proxy.runId, runId); assert.equal(proxy.uid, 'sgm-qa-parent');
  assert.equal(proxy.failed, undefined); assert.equal(proxy.phase, 'reject'); assert.deepEqual(proxy.transitions, []);
  assert.deepEqual(proxy.attempts, [{ phase: 'reject', method: 'initializeUserProfile', uid: 'sgm-qa-parent',
    injectedRejection: true, downstreamStatus: 503 }]);
}

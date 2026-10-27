import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { assertEvidenceBundleChecksums } from './evidence-bundle-checksums.mjs';
import { assertRetainedSourceFiles } from './retained-source-evidence.mjs';
import { assertInstrumentationPassed } from './android-instrumentation-result.mjs';
import { assertChatNetworkReceipt, assertTransportRequestSetup } from './chat-network-evidence.mjs';
import { assertNetworkStartReceipt } from './network-start-evidence.mjs';

export const chatNetworkIsolatedFolder = 'docs/release/evidence/chat-network-isolated-2026-10-27/';
export function validateChatNetworkIsolated(root) {
  const base = resolve(root, chatNetworkIsolatedFolder); assertEvidenceBundleChecksums(base);
  const bytes = file => readFileSync(resolve(base, file)), json = file => JSON.parse(bytes(file));
  const run = json('chat-network-recovery-results.json'), ui = json('local-chat-network-ui.json');
  assert.equal(run.projectId, 'demo-sgm-local-qa'); assert.equal(run.runId, '644b0af26dff97be7e8bb291766f4cc4');
  assert.equal(run.scope, 'isolated-chat-network-ui-not-physical-network-loss');
  assert.equal(run.testedAt.slice(0, 10), '2026-10-27'); assert.equal(run.testCount, 1); assert.equal(run.nativeCaseCount, 1);
  assert.deepEqual(run.steps, [{ id: 'chat-network-recovery-ui', status: 'passed' }]);
  for (const key of ['nativeUiExecuted', 'localPackagesRemoved', 'adminClientClosed', 'firestoreClientTerminated',
    'isolatedEnvironmentDestroyed', 'emulatorCliExitedSuccessfully']) assert.equal(run[key], true, key);
  for (const key of ['productionWrites', 'physicalDevice', 'safetyAuditAccepted', 'storeReviewAccepted']) assert.equal(run[key], false, key);
  assert.equal(run.cleanupMode, 'destroy-owned-local-environment'); assert.equal(run.emulatorEndpoints.closed, true);
  assert.equal(run.emulatorEndpoints.host, '127.0.0.1');
  assert.equal(ui.runId, run.runId); assertChatNetworkReceipt(ui); assertTransportRequestSetup(ui); assertNetworkStartReceipt(ui);
  assert.equal(run.network.messageCount, 2); assert.equal(run.network.notificationCount, 2); assert.equal(run.network.duplicateMessages, 0);
  for (const key of ['offlineDraftRetained', 'accountDraftCleared', 'networkRestored']) assert.equal(run.network[key], true);
  assert.deepEqual(run.network.bookingStatuses, ['approved', 'cancelled', 'declined', 'requested']);
  assert.equal(run.history.method, 'isolated-callable-fixture-not-ui-verification');
  assert.deepEqual(run.history.bookings.map(row => row.status), ['declined', 'cancelled']);
  const copy = json('adb-pull-network-recovery.json'); assert.equal(copy.runId, run.runId);
  assert.equal(copy.phase, 'network-recovery'); assert.equal(copy.completed, true); assert.equal(copy.status, 0);
  assert.equal(copy.errorCode, null); assert.equal(copy.signal, null);
  const transcript = bytes('LocalChatNetworkFlowTest-instrumentation.txt');
  assert.equal(createHash('sha256').update(transcript).digest('hex'), run.transcriptSha256);
  assertInstrumentationPassed(transcript.toString(), 1); assertRetainedSourceFiles(root, run.sourceFiles);
  const setup = json('disposable-device-setup.json'), restore = json('disposable-device-restore.json');
  assert.equal(setup.case, 'chat-network-recovery'); assert.equal(restore.case, setup.case);
  assert.equal(run.apkPreparation.receiptSha256, createHash('sha256').update(bytes('disposable-device-setup.json')).digest('hex'));
  assert.deepEqual(run.apkPreparation.apkHashes, setup.apkHashes); assert.equal(run.apkPreparation.installationsRemainedBlocked, true);
  assert.equal(restore.restored, true); assert.equal(restore.verified, true); assert.equal(restore.observed.continuousGuardVerified, true);
  for (const key of ['localPackagesRemoved', 'background', 'stopped', 'launcher']) assert.equal(restore.restoration[key], true);
  for (const key of ['authorizationRemoved', 'componentRemoved', 'originalPolicyRestored']) assert.equal(restore.restoration.installAdmin[key], true);
  const job = json('job.json'), artifact = json('artifact.json');
  const head = '04ce4d4f073e2ba7c406e1adfe0ee6d57b433997';
  assert.equal(job.id, 122180209848); assert.equal(job.run_id, 40501549204); assert.equal(job.head_sha, head);
  assert.equal(job.status, 'completed'); assert.equal(job.conclusion, 'success');
  assert.equal(artifact.id, 12732624464); assert.equal(artifact.name, 'android-focused-safety-ui-chat-network-recovery');
  assert.equal(artifact.workflow_run.id, job.run_id); assert.equal(artifact.workflow_run.head_sha, head);
  const review = json('visual-review.json'); assert.equal(review.runId, run.runId); assert.equal(review.sourceCommit, head);
  assert.deepEqual(review.published, {
    'chat-network-isolated-draft': 'captures/local-chat-network-unconfirmed.png',
    'chat-network-isolated-reply': 'captures/local-chat-network-received.png',
  });
  assert.equal(review.excluded['local-chat-network-recovered.png'], 'Incomplete window redraw; not published.');
  for (const file of Object.values(review.published)) {
    const png = bytes(file); assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.equal(png.readUInt32BE(16), 1080); assert.equal(png.readUInt32BE(20), 2400);
  }
  return { run, publishedCaptures: review.published };
}

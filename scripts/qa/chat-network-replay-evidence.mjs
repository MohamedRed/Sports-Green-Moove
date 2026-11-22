import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {assertEvidenceBundleChecksums} from './evidence-bundle-checksums.mjs';
import {assertRetainedSourceFiles} from './retained-source-evidence.mjs';
import {assertInstrumentationPassed} from './android-instrumentation-result.mjs';
import {assertChatNetworkReceipt, assertTransportRequestSetup} from './chat-network-evidence.mjs';
import {assertNetworkStartReceipt} from './network-start-evidence.mjs';

export function validateChatNetworkReplay(root, expected) {
  const base = resolve(root, expected.folder); assertEvidenceBundleChecksums(base);
  const bytes = file => readFileSync(resolve(base, file)), json = file => JSON.parse(bytes(file));
  const run = json('chat-network-recovery-results.json'), ui = json('local-chat-network-ui.json');
  assert.equal(run.projectId, 'demo-sgm-local-qa'); assert.equal(run.runId, expected.runId);
  assert.equal(run.scope, 'isolated-chat-network-ui-not-physical-network-loss');
  assert.equal(run.testedAt.slice(0, 10), expected.date); assert.equal(run.testCount, 1); assert.equal(run.nativeCaseCount, 1);
  assert.deepEqual(run.steps, [{id: 'chat-network-recovery-ui', status: 'passed'}]);
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
  assert.equal(job.id, expected.jobId); assert.equal(job.run_id, expected.workflowId); assert.equal(job.head_sha, expected.head);
  assert.equal(job.status, 'completed'); assert.equal(job.conclusion, 'success');
  assert.equal(artifact.id, expected.artifactId); assert.equal(artifact.name, 'android-focused-safety-ui-chat-network-recovery');
  assert.equal(artifact.workflow_run.id, job.run_id); assert.equal(artifact.workflow_run.head_sha, expected.head);
  return {run, bytes, json};
}

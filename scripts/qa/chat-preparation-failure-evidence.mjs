import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {assertEvidenceBundleChecksums} from './evidence-bundle-checksums.mjs';

export const chatPreparationFolder = 'docs/release/evidence/chat-preparation-30272e0-2026-11-02/';
export function validateChatPreparationFailure(root) {
  const folder = resolve(root, chatPreparationFolder), bytes = file => readFileSync(resolve(folder, file));
  const json = file => JSON.parse(bytes(file)); assertEvidenceBundleChecksums(folder);
  const review = json('review.json');
  assert.equal(review.scope, 'focused-chat-network-preparation-failure-not-message-resend-or-cause-proof');
  assert.equal(review.sourceCommit, '30272e0ca56d3c50ffdf0258f8a13eabf1b49d9f');
  assert.equal(review.testedAt, '2026-11-02');
  for (const key of ['networkPreparationFailed', 'draftReached']) assert.equal(review[key], true, key);
  for (const key of ['mobileDefaultAvailable', 'messageResendExecuted', 'sourceSpecificFullGatePassed', 'rootCauseConfirmed',
    'previousSuccessInvalidated', 'physicalDeviceAccepted', 'productionWrites', 'changedTestConditions', 'releaseAccepted']) assert.equal(review[key], false, key);
  assert.deepEqual(review.publishedMedia, []);
  const job = json('job.json'), artifact = json('artifact.json'), archive = json('archive-verification.json');
  assert.equal(job.id, 125277691092); assert.equal(job.id, review.jobId); assert.equal(job.run_id, review.workflowId);
  assert.equal(job.head_sha, review.sourceCommit); assert.equal(job.status, 'completed'); assert.equal(job.conclusion, 'failure');
  assert.equal(artifact.id, 13142393131); assert.equal(artifact.id, review.artifactId);
  assert.equal(artifact.workflow_run.id, review.workflowId); assert.equal(artifact.workflow_run.head_sha, review.sourceCommit);
  assert.equal(archive.sha256, artifact.digest.slice('sha256:'.length)); assert.equal(archive.bytes, artifact.size_in_bytes);
  assert.equal(Object.keys(archive.members).length, 12);
  for (const [file, member] of Object.entries(archive.members)) {
    assert.equal(createHash('sha256').update(bytes(file)).digest('hex'), member.sha256, file);
    assert(member.member.startsWith('local-ui-evidence/940392e133a7bbb3f059fa69948111c3/') ||
      member.member.startsWith('focused-safety-ui/chat-network-recovery/'));
  }
  const ui = json('ui.json'); assert.equal(ui.runId, '940392e133a7bbb3f059fa69948111c3');
  assert.equal(ui.projectId, 'demo-sgm-local-qa'); assert.equal(ui.completed, false);
  assert.equal(ui.failedPhase, 'network-preparation'); assert.deepEqual(ui.network, []);
  assert.equal(ui.cellularRequestReleased, true); assert.equal(ui.wifiRequestReleased, true);
  for (const sample of [ui.initialNetwork, ui.preparation, ui.preparationFailure]) {
    assert.equal(sample.hasDefaultDataSubscription, false); assert.equal(sample.backendReachable, true);
    assert.equal(sample.cellularAvailableCallbacks, 0); assert.deepEqual(sample.internetTransports, ['wifi']);
  }
  for (const file of ['subscriptions-before.json', 'subscriptions-after.json', 'bootstrap-subscriptions.json'])
    assert.equal(json(file).defaultSubscriptionValid.defaultDataSubId, false);
  assert.equal(json('selection-after.json').recognizedEventCount, 0);
  assert.equal(json('selection-after.json').lastReadiness, null);
  const bootstrap = json('bootstrap-properties.json'); assert.equal(bootstrap.testAppsAbsent, true);
  assert.equal(bootstrap.radioOrLoggingSettingsChanged, false); assert.equal(bootstrap.flowCompleted, false);
  const readiness = json('wifi-readiness.json'); assert.equal(readiness.ready, true); assert.equal(readiness.flowCompleted, false);
  assert.equal(readiness.testAppsAbsent, true); assert.equal(readiness.settingsChanged, false);
  assert.equal(json('suite-status.json').status, 1);
  assert.match(bytes('instrumentation.txt').toString(), /ComposeTimeoutException[\s\S]*LocalChatNetworkFlowTest.kt:83/);
  assert.match(bytes('instrumentation.txt').toString(), /Tests run: 1,\s+Failures: 1/);
  const restore = json('device-restore.json'); assert.equal(restore.restored, true); assert.equal(restore.verified, true);
  for (const key of ['localPackagesRemoved', 'background', 'stopped', 'launcher']) assert.equal(restore.restoration[key], true, key);
  for (const key of ['authorizationRemoved', 'componentRemoved', 'originalPolicyRestored']) assert.equal(restore.restoration.installAdmin[key], true, key);
  const host = json('host-disposed.json'); assert.equal(host.targetExitObserved, true); assert.equal(host.finalState, 'gone');
  assert.equal(host.processSignalsRequested, false); assert.equal(host.flowAccepted, false);
  return {preparationFailed: true, messageResendExecuted: false, rootCauseConfirmed: false, releaseAccepted: false};
}

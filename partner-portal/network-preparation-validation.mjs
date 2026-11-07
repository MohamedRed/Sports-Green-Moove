import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {assertEvidenceBundleChecksums} from '../scripts/qa/evidence-bundle-checksums.mjs';
import {assertRetainedSourceFiles} from '../scripts/qa/retained-source-evidence.mjs';
import {assertChatNetworkReceipt, assertTransportRequestSetup} from '../scripts/qa/chat-network-evidence.mjs';
import {assertNetworkStartReceipt} from '../scripts/qa/network-start-evidence.mjs';

export const networkPreparationFolder = 'docs/release/evidence/network-preparation-3eae535-2026-11-01/';
export function validateNetworkPreparationRecheck(root, folder = networkPreparationFolder) {
  const base = resolve(root, folder), bytes = name => readFileSync(resolve(base, name)), json = name => JSON.parse(bytes(name));
  assertEvidenceBundleChecksums(base); const review = json('review.json');
  assert.equal(review.scope, 'paired-independent-native-chat-preparation-failure-and-pass-not-root-cause-or-release');
  assert.equal(review.checkedAt, '2026-11-01'); assert.equal(review.nativeCasesPassed, 1); assert.equal(review.screenshotsPublished, 0);
  for (const key of ['changedTestConditions', 'defaultSelectionCauseProven', 'missingDefaultRepaired', 'fullNativeGateAccepted',
    'physicalDeviceAccepted', 'radioLossAccepted', 'postCommitLossAccepted', 'productionWrites', 'releaseAccepted']) assert.equal(review[key], false, key);
  assertRetainedSourceFiles(root, review.sharedSourceFiles);
  assert.equal(Object.keys(review.sharedSourceFiles).length, 31);
  const pass = json('pass/producer.json'), failed = json('failed/producer.json');
  assert.deepEqual([pass.run, pass.jobId, pass.artifactId, pass.commit, pass.sha256, pass.conclusion],
    [41360242235, 125008879000, 13105240971, '3eae5352f1da43531bc016afc67a8e44b5a9ea52',
      '0ff2bda3b441cf31c01c2d77c4aeb22e1a2acd3d1fd0da4f40ba11af6d1451e9', 'success']);
  assert.deepEqual([failed.run, failed.jobId, failed.artifactId, failed.commit, failed.sha256, failed.conclusion],
    [41356410907, 124997296280, 13103354946, '8369af5424e9e48232cf98b83ef58b3275e9827e',
      '5e401a493854bc56484ffae7099408134ca55f3e96712275cdcadce7fc94c395', 'failure']);
  const ui = json('pass/ui.json'), result = json('pass/results.json'), app = json('pass/app-results.json');
  assert.equal(ui.runId, pass.runId); assert.equal(result.runId, pass.runId); assert.equal(app.runId, pass.runId);
  assertChatNetworkReceipt(ui); assertTransportRequestSetup(ui); assertNetworkStartReceipt(ui);
  for (const [key, value] of Object.entries(app)) assert.deepEqual(result[key], value, key);
  assert.equal(result.scope, 'isolated-chat-network-ui-not-physical-network-loss');
  assert.equal(result.testCount, 1); assert.equal(result.nativeCaseCount, 1); assert.equal(result.nativeUiExecuted, true);
  for (const key of ['localPackagesRemoved', 'adminClientClosed', 'firestoreClientTerminated', 'isolatedEnvironmentDestroyed',
    'emulatorCliExitedSuccessfully']) assert.equal(result[key], true, key);
  for (const key of ['productionWrites', 'physicalDevice', 'safetyAuditAccepted', 'storeReviewAccepted']) assert.equal(result[key], false, key);
  assert.deepEqual(result.sourceFiles, review.sharedSourceFiles); assert.equal(result.primaryEvidencePhase, 'network-recovery');
  assert.equal(result.network.messageCount, 2); assert.equal(result.network.notificationCount, 2); assert.equal(result.network.duplicateMessages, 0);
  const transcript = bytes('pass/instrumentation.txt'); assert.match(transcript.toString(), /OK \(1 test\)/);
  assert.equal(createHash('sha256').update(transcript).digest('hex'), result.transcriptSha256);
  const copy = json('pass/primary-copy.json'); assert.equal(copy.runId, pass.runId); assert.equal(copy.phase, 'network-recovery');
  assert.equal(copy.completed, true); assert.equal(copy.status, 0); assert.equal(copy.signal, null); assert.equal(copy.errorCode, null);
  assert.equal(result.emulatorEndpoints.closed, true); assert.deepEqual(result.emulatorEndpoints.ports, [9099, 8080, 9000, 5001]);
  const negative = json('failed/ui.json'); assert.equal(negative.runId, failed.runId); assert.equal(negative.completed, false);
  assert.equal(negative.failedPhase, 'network-preparation'); assert.deepEqual(negative.network, []);
  assert.equal(negative.preparationFailure.hasDefaultDataSubscription, false);
  assert.equal(negative.preparationFailure.backendReachable, true); assert.equal(negative.preparationFailure.cellularAvailableCallbacks, 0);
  assert.deepEqual(negative.preparationFailure.activeInternetTransports, ['wifi']);
  assert.match(bytes('failed/instrumentation.txt').toString(), /ComposeTimeoutException[\s\S]*LocalChatNetworkFlowTest.kt:83/);
  assert.match(bytes('failed/instrumentation.txt').toString(), /Tests run: 1,\s+Failures: 1/);
  for (const [label, producer] of [['pass', pass], ['failed', failed]]) {
    const state = json(label + '/subscriptions-before.json'); assert.equal(state.runId, producer.runId);
    assert.equal(state.defaultSubscriptionValid.defaultDataSubId, label === 'pass');
    assert.equal(state.allSubscriptionsLoaded, true); assert.equal(state.modemCount, 1); assert.equal(state.mappedSlotCount, 1);
    const bootstrap = json(label + '/bootstrap-subscriptions.json');
    assert.equal(bootstrap.defaultSubscriptionValid.defaultDataSubId, label === 'pass');
    assert.equal(bootstrap.allSubscriptionsLoaded, true);
    const bootCarrier = json(label + '/bootstrap-carrier.json');
    assert.deepEqual(bootCarrier.configChangeSent, [label === 'pass']);
    assert.deepEqual(bootCarrier.serviceBoundForNoSimConfig, [label !== 'pass']);
    const restore = json(label + '/disposable-device-restore.json'); assert.equal(restore.restored, true); assert.equal(restore.verified, true);
    for (const key of ['localPackagesRemoved', 'background', 'stopped', 'launcher']) assert.equal(restore.restoration[key], true, key);
    for (const key of ['authorizationRemoved', 'componentRemoved', 'originalPolicyRestored']) assert.equal(restore.restoration.installAdmin[key], true, key);
    const host = json(label + '/host-disposed.json'); assert.equal(host.targetExitObserved, true); assert.equal(host.finalState, 'gone');
    assert.equal(host.processSignalsRequested, false); assert.equal(host.flowAccepted, false);
    assert.equal(json(label + '/chat-network-recovery-suite-status.json').status, label === 'pass' ? 0 : 1);
  }
  // A later loaded configuration did not establish a default selection in the failed trial.
  assert.deepEqual(json('failed/carrier-after.json').configChangeSent, [true]);
  assert.deepEqual(json('failed/carrier-after.json').configBundlePresent.defaultApp, [true]);
  assert.equal(json('failed/subscriptions-after.json').defaultSubscriptionValid.defaultDataSubId, false);
  return {nativeChatNetworkCasePassed: true, preservedPreparationFailure: true, nativeCases: 1,
    unchangedSourceFiles: Object.keys(review.sharedSourceFiles).length, rootCauseProven: false, fullGateAccepted: false, releaseAccepted: false};
}

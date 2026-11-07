import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {imageSize} from 'image-size';
import {assertEvidenceBundleChecksums} from './evidence-bundle-checksums.mjs';
import {assertRetainedSourceFiles} from './retained-source-evidence.mjs';
import {chatNetworkPhonePhases, verifyChatNetworkPhoneCheckpoint} from './chat-network-phone-checkpoints.mjs';

export const chatNetworkPhoneFolder = 'docs/release/evidence/chat-network-phone-2026-10-31/';
export function validateChatNetworkPhone(root) {
  const folder = resolve(root, chatNetworkPhoneFolder), bytes = file => readFileSync(resolve(folder, file));
  const json = file => JSON.parse(bytes(file)); assertEvidenceBundleChecksums(folder);
  const review = json('review.json'), result = json('records/results.json'), baseline = json('records/baseline.json');
  assert.equal(review.scope, 'physical-android-controlled-offline-chat-retry-with-sdk-peer-not-real-radio-loss');
  assert.equal(review.projectId, 'demo-sgm-local-qa'); assert.equal(result.projectId, review.projectId);
  assert.match(review.runId, /^[a-f0-9]{32}$/); assert.equal(result.runId, review.runId);
  assert.deepEqual(review.device, {model: 'Google Pixel 9 Pro', android: '15.0', physical: true});
  assert.equal(result.completed, true); assert.equal(result.failed, false);
  assert.deepEqual(result.checkpoints.map(row => row.phase), chatNetworkPhonePhases);
  for (const phase of chatNetworkPhonePhases) {
    const record = json('records/' + phase + '.json'); assert.equal(record.runId, review.runId);
    assert.deepEqual(record.check, verifyChatNetworkPhoneCheckpoint(phase, baseline, record.state, result.fixture));
    assert.match(record.observedAt, /^2026-10-31T/);
  }
  assert.equal(result.adminClientClosed, true); assert.equal(result.firestoreClientTerminated, true);
  assert.equal(result.controllerSubmittedParentMessages, false); assert.equal(result.controllerSubmittedDriverReply, true);
  assert.equal(result.phoneUiProvenByObserver, false); assert.equal(result.physicalRadioLossProvenByObserver, false);
  assertRetainedSourceFiles(root, result.sourceFiles); assertRetainedSourceFiles(root, json('app-source-sha256.json'));
  assert.equal(json('apk-provenance.json').sha256, 'c7c6f2a4b806c20a81c646b8d3fa0f06087f03c28babf26c80e7f9e23f35b08b');
  assert.equal(review.physicalControlledOfflineRetryAccepted, true); assert.equal(review.checkpointCount, 8);
  assert.equal(review.independentStoredMessages, 2); assert.equal(review.independentStoredNotifications, 2);
  assert.equal(review.parentMessageSentByController, false); assert.equal(review.driverReplySentByController, true);
  for (const key of ['automaticSendBeforeRetryObserved', 'realWorldRadioLossAccepted', 'lostResponseAfterCommitAccepted',
    'physicalTrackingAccepted', 'independentProcessRestartAccepted', 'peerPhoneAccepted', 'pushDeliveryAccepted',
    'installedBytesIndependentlyAttested', 'packageAbsenceIndependentlyMeasured', 'realPaymentsExercised', 'productionWrites',
    'iOSAccepted', 'fullNativeGateAccepted', 'priorCopyFailureFixed', 'releaseAccepted']) assert.equal(review[key], false, key);
  assert.equal(review.mapsRequests, 0);
  assert.equal(review.captureKind, 'original-session-window-crops-not-native-device-exports');
  const names = ['offline-unconfirmed', 'online-before-retry', 'parent-sent', 'reply-read'];
  assert.deepEqual(review.publishedCaptures, Object.fromEntries(names.map(name => ['chat-phone-' + name, 'captures/' + name + '.jpg'])));
  for (const file of Object.values(review.publishedCaptures)) {
    const size = imageSize(bytes(file)); assert.equal(size.width, 216); assert.equal(size.height, 457);
  }
  assert.deepEqual(review.privateHelperScope, {ports: [5001, 8080, 9000, 9099], forceLocal: false, aliasEnabled: false, requestLoggingEnabled: false});
  assert.equal(json('network-offline.json').providerAcknowledged, true);
  assert.equal(json('network-restored-confirmed.json').providerAcknowledged, true);
  assert.equal(json('network-restored-confirmed.json').localTestingEnabled, true);
  const defaults = bytes('network-default-observation.txt').toString();
  assert.match(defaults, /text Turn off network simulation/); assert.match(defaults, /Description: Offline Mode .*Value: 0/);
  const phone = json('phone-disposal.json');
  for (const key of ['signedOutObserved', 'sessionEnded', 'networkSimulationRestored', 'hostClipboardRestored']) assert.equal(phone[key], true);
  assert.equal(phone.testDevicePolicyChanged, false);
  assert.equal(json('uninstall-observation.json').providerAcknowledged, true);
  assert.equal(json('uninstall-observation.json').packageAbsenceIndependentlyMeasured, false);
  const disposal = json('disposal.json'); assert.equal(disposal.observerExitCode, 0);
  assert.equal(disposal.backendExitCode, 130); assert.equal(disposal.helperExitCode, 130);
  for (const key of ['helperGroupExitVerified', 'privateSessionAbsent', 'runtimeAbsent', 'helperDirectoryAbsent']) assert.equal(disposal[key], true);
  assert.deepEqual(disposal.closedPorts, [5001, 8080, 9000, 9099]);
  return {checkpoints: 8, messages: 2, notifications: 2, physicalControlledOfflineRetryAccepted: true, releaseAccepted: false};
}

import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {imageSize} from 'image-size';
import {assertEvidenceBundleChecksums} from './evidence-bundle-checksums.mjs';
import {assertRetainedSourceFiles} from './retained-source-evidence.mjs';
import {chatReceiptLossPhases, verifyChatReceiptLossCheckpoint} from './chat-receipt-loss-checkpoints.mjs';

export const chatReceiptPhoneFolder = 'docs/release/evidence/chat-receipt-loss-phone-2026-11-01/';
export const chatReceiptPhoneImages = ['parent-confirmed', 'parent-reopened', 'driver-visible'];
export function assertChatReceiptPhoneReview(review) {
  assert.equal(review.scope, 'physical-android-one-device-post-commit-chat-reply-loss-with-isolated-data');
  assert.equal(review.reviewedAt, '2026-11-01'); assert.match(review.runId, /^[0-9a-f]{32}$/);
  assert.equal(review.controllerCommit, '1a8939b120480fcb87d271f8807898868f105501');
  assert.deepEqual(review.device, {model: 'Google Pixel 9 Pro', android: '15.0', physical: true});
  for (const key of ['parentIdentityObserved', 'targetConversationInitiallyEmpty', 'parentSendObserved',
    'commitVerifiedBeforeWithholding', 'originalClientMessageIdObserved', 'singleConfirmedBubbleObserved',
    'liveListenerReconciledWithoutExplicitRetry', 'parentReopenedSameConversation', 'driverIdentityObserved',
    'driverUnreadBadgeObserved', 'driverIncomingMessageObserved', 'driverReadIndependentlyVerified', 'signedOutObserved'])
    assert.equal(review[key], true, key);
  for (const key of ['explicitRetryExercised', 'processRestartAccepted', 'peerPhoneAccepted', 'realRadioLossAccepted',
    'trackingAccepted', 'iOSAccepted', 'pushDeliveryAccepted', 'productionWrites', 'realPayments',
    'applicationDeployed', 'installedBytesIndependentlyAttested', 'wholeCurrentApkAttested', 'releaseAccepted',
    'videoProduced', 'screenSharingPermissionsChanged', 'chromeRestarted']) assert.equal(review[key], false, key);
  assert.equal(review.recordCheckpoints, 8); assert.equal(review.mapRequests, 0); assert.equal(review.forwardedSendCount, 1);
  assert.equal(review.videoRecordingAttempted, true);
  assert.equal(review.captureKind, 'original-session-window-crops-not-native-exports');
  assert.deepEqual(review.captureClip, {x: 615, y: 109, width: 274, height: 618});
  assert.deepEqual(review.publishedCaptures, chatReceiptPhoneImages);
  assert.deepEqual(review.privateHelper, {ports: [5001, 8080, 9000, 9099], upstreamPort: 5002,
    invitationPortEnabled: false, forceLocal: false, requestLoggingEnabled: false});
}

export function validateChatReceiptPhone(root, folder = chatReceiptPhoneFolder) {
  const base = resolve(root, folder), bytes = file => readFileSync(resolve(base, file)), json = file => JSON.parse(bytes(file));
  assertEvidenceBundleChecksums(base); const review = json('review.json'); assertChatReceiptPhoneReview(review);
  const result = json('records/session-results.json'), fixture = json('records/fixture.json');
  const baseline = json('records/baseline.json'), original = json('records/original-commit.json').message;
  assert.equal(result.projectId, 'demo-sgm-local-qa'); assert.equal(result.runId, review.runId);
  assert.equal(fixture.runId, result.runId); assert.equal(fixture.fixtureSubmittedChatMessages, 0);
  assert.equal(result.completed, true); assert.equal(result.failedCheckpoint, null); assert.equal(result.failureKind, null);
  assert.equal(result.sourceFilesUnchanged, true); assertRetainedSourceFiles(root, result.sourceFiles);
  assert.deepEqual(result.checks.map(row => row.phase), chatReceiptLossPhases);
  let previous = 0;
  for (const check of result.checks) {
    const observation = json('records/' + check.phase + '.json'); assert.deepEqual(observation.check, check);
    assert.deepEqual(verifyChatReceiptLossCheckpoint(check.phase, baseline, observation.state, fixture.fixture,
      observation.proxy, original), check);
    const time = Date.parse(observation.observedAt); assert(time > previous); previous = time;
  }
  for (const key of ['adminClientClosed', 'firestoreClientTerminated']) assert.equal(result[key], true, key);
  for (const key of ['controllerSubmittedChatMessages', 'phoneUiProvenByObserver', 'physicalRadioLossProvenByObserver',
    'installedBytesIndependentlyVerified', 'productionWrites', 'realPayments']) assert.equal(result[key], false, key);
  assert.equal(result.fixtureSubmittedChatMessages, 0); assert.equal(result.mapRequests, 0);
  assert.equal(result.proxy.failed, false); assert.equal(result.proxy.attempts.length, 1);
  assert.equal(result.proxy.attempts[0].responseReleased, false);
  assert.deepEqual(result.proxy, json('records/signed-out.json').proxy);
  verifyChatReceiptLossCheckpoint('receipt-lost', baseline, json('records/original-commit.json').state,
    fixture.fixture, json('records/receipt-lost.json').proxy, original);
  assert.equal(result.sourceApkSha256, '507c3fa6bb2e9bdc6139162b2cd4d6dd2de1770f876b0dfce7395a8c9c9b8c17');
  const failed = json('failed-attempt/session-results.json');
  assert.equal(failed.completed, false); assert.equal(failed.proxy.failed, true); assert.equal(failed.proxy.attempts.length, 0);
  assert.deepEqual(failed.checks.map(row => row.phase), ['parent-ready']); assert.notEqual(failed.runId, result.runId);
  assert.equal(failed.sourceFilesUnchanged, true); assertRetainedSourceFiles(root, failed.sourceFiles);
  const disposal = json('disposal.json'); assert(Date.parse(disposal.observedAt) > previous);
  for (const key of ['sessionEnded', 'providerUninstallReceiptObserved', 'originallyEmptyHostClipboardRestored',
    'privateFilesAbsent', 'helperDirectoriesAbsent', 'ownedPortsClosed', 'ownedProcessGroupsStopped']) assert.equal(disposal[key], true, key);
  assert.equal(disposal.packageAbsenceIndependentlyVerified, false);
  assert.equal(disposal.filteredPackageInventorySupported, false);
  const times = json('capture-times.json');
  for (const name of chatReceiptPhoneImages) {
    const size = imageSize(bytes('captures/' + name + '.png')); assert.equal(size.width, 274); assert.equal(size.height, 618);
    const originalSize = imageSize(bytes('original-session-captures/' + name + '.png'));
    assert.equal(originalSize.width, 1440); assert.equal(originalSize.height, 778);
    assert(Number.isFinite(Date.parse(times[name])));
  }
  return {postCommitReplyLossOnOnePhysicalPhonePassed: true, checkpoints: 8, messages: 1, notifications: 1,
    explicitRetryExercised: false, peerPhoneAccepted: false, realRadioLossAccepted: false, releaseAccepted: false};
}

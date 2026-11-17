import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {imageSize} from 'image-size';
import {assertEvidenceBundleChecksums} from './evidence-bundle-checksums.mjs';
import {assertRetainedSourceFiles} from './retained-source-evidence.mjs';
import {verifyChatNetworkPhoneCheckpoint} from './chat-network-phone-checkpoints.mjs';

export const chatDraftReplayPhoneFolder = 'docs/release/evidence/chat-draft-replay-phone-2026-10-31/';
export function validateChatDraftReplayReview(review) {
  assert.equal(review.scope, 'physical-unsent-draft-restored-after-android-settings-force-stop');
  assert.equal(review.reviewedAt, '2026-10-31');
  assert.deepEqual(review.device, {model: 'Google Pixel 9 Pro', android: '15.0', physical: true});
  for (const key of ['sameConversationReopenRestoresDraft', 'keyboardAndComposerVisible', 'sameVisibleDraftRestored',
    'androidForceStopEnabledBefore', 'androidForceStopConfirmationObserved', 'androidForceStopDisabledAfter',
    'openedInstalledAppWithoutReinstall', 'authenticatedHomeReturned', 'providerDevToolsUnavailable']) assert.equal(review[key], true, key);
  for (const key of ['independentProcessIdsObserved', 'providerKillCompletionAccepted', 'actualMessageSendAccepted',
    'accountSwitchOnPhoneAccepted', 'pendingSendRestartAccepted', 'realRadioLossAccepted', 'trackingAccepted',
    'peerPhoneAccepted', 'iOSAccepted', 'productionWrites', 'realPayments', 'applicationDeployed', 'releaseAccepted']) {
    assert.equal(review[key], false, key);
  }
  assert.equal(review.stopMechanism, 'android-app-info-force-stop-confirmation');
  assert.equal(review.captureKind, 'original-session-window-crops-not-native-exports');
  assert.deepEqual(review.captureClip, {x: 484, y: 110, width: 200, height: 435});
  assert.deepEqual(review.publishedCaptures, ['01-draft-keyboard', '08-os-reopened']);
  assert.equal(review.independentZeroMessageCheckpoints, 7); assert.equal(review.mapsRequests, 0);
  assert.deepEqual(review.privateHelper, {ports: [5001, 8080, 9000, 9099], aliasEnabled: false, forceLocal: false, requestLoggingEnabled: false});
}

export function validateChatDraftReplayPhone(root) {
  const folder = resolve(root, chatDraftReplayPhoneFolder); assertEvidenceBundleChecksums(folder);
  const bytes = name => readFileSync(resolve(folder, name)), read = name => JSON.parse(bytes(name));
  validateChatDraftReplayReview(read('review.json'));
  const result = read('observer/results.json'), baseline = read('observer/baseline.json');
  assert.equal(result.projectId, 'demo-sgm-local-qa'); assert.equal(result.completed, true); assert.equal(result.failed, false);
  assert.equal(result.scope, 'independent-unsent-chat-records-not-keyboard-or-draft-restoration-proof');
  assert.equal(result.runId, baseline.runId); assert.deepEqual(result.fixture, baseline.fixture);
  assert.deepEqual(result.checkpoints.map(row => row.phase),
    ['ready', 'conversation-open', 'draft-visible', 'conversation-reopened', 'process-stopped', 'process-reopened', 'signed-out']);
  for (const checkpoint of result.checkpoints) {
    assert(checkpoint.zeroMessages && checkpoint.zeroNotifications && checkpoint.protectedRecordsUnchanged);
    assert.equal(checkpoint.phoneUiProvenByObserver, false);
    const observation = read('observer/' + checkpoint.phase + '.json');
    assert.equal(observation.runId, result.runId); assert.deepEqual(observation.checkpoint, checkpoint);
    verifyChatNetworkPhoneCheckpoint('ready', baseline.state, observation.state, result.fixture);
  }
  for (const key of ['adminClientClosed', 'firestoreClientTerminated']) assert.equal(result[key], true);
  for (const key of ['productionWrites', 'realPayments', 'phoneUiProvenByObserver', 'processRestartProvenByObserver']) assert.equal(result[key], false);
  assert.equal(result.mapRequests, 0);
  const sources = read('source-files.json'); assertRetainedSourceFiles(root, sources);
  for (const [path, digest] of Object.entries(result.sourceFiles)) assert.equal(sources[path], digest);
  const apk = read('apk-provenance.json');
  assert.equal(apk.sourceCommit, '86746f4c1a9c58a583073e0f64292ec1146cda90');
  assert.equal(apk.sha256, 'f707cb41e5b59147acc9e94c69115edbe6dc95c528b52586fb36c83eefe524e8');
  assert.equal(apk.packageName, 'be.sportgreenmoove.app.local'); assert.equal(apk.projectId, result.projectId);
  assert.equal(apk.emulatorHost, '127.0.0.1'); assert.equal(apk.realMapsUi, false);
  assert.equal(apk.selectedFilenameObserved, true); assert.equal(apk.installedBytesIndependentlyAttested, false);
  const times = read('capture-times.json'); let previous = 0;
  for (const name of ['01-draft-keyboard', '02-conversation-reopened', '03-system-app-info', '04-provider-reopened',
    '05-before-os-stop', '06-os-stop-confirm', '07-os-stopped', '08-os-reopened']) {
    for (const kind of ['app', 'context']) {
      const file = 'captures/' + name + '-' + kind + '.png', dimensions = imageSize(bytes(file));
      assert(dimensions.width > 0 && dimensions.height > 0);
      if (kind === 'app') {assert.equal(dimensions.width, 200); assert.equal(dimensions.height, 435);}
      assert(Number.isFinite(Date.parse(times[file])));
    }
    const current = Date.parse(times['captures/' + name + '-app.png']); assert(current > previous); previous = current;
  }
  const disposal = read('disposal.json');
  for (const key of ['privateSessionAbsent', 'runtimeAbsent', 'helperDirectoryAbsent', 'helperGroupExitVerified',
    'sessionEnded', 'signedOutObserved', 'hostClipboardRestored', 'providerUninstallAcknowledged']) assert.equal(disposal[key], true);
  assert.equal(disposal.packageAbsenceIndependentlyVerified, false); assert.equal(disposal.deviceSettingsChanged, false);
  assert.deepEqual(disposal.ports, {host: '127.0.0.1', ports: [9099, 8080, 9000, 5001], closed: true});
  assert(previous < Date.parse(disposal.observedAt));
}

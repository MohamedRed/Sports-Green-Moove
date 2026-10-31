import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {XMLParser} from 'fast-xml-parser';
import {imageSize} from 'image-size';
import {assertEvidenceBundleChecksums} from './evidence-bundle-checksums.mjs';
import {assertRetainedSourceFiles} from './retained-source-evidence.mjs';
import {verifyChatNetworkPhoneCheckpoint} from './chat-network-phone-checkpoints.mjs';

export const chatDraftPhoneFolder = 'docs/release/evidence/chat-draft-phone-2026-10-31/';
export function validateChatDraftPhoneReview(review, before, stopped, after) {
  assert.equal(review.scope, 'physical-unsent-chat-draft-loss-and-local-candidate-not-repair-acceptance');
  assert.equal(review.reviewedAt, '2026-10-31');
  assert.deepEqual(review.device, {model: 'Google Pixel 9 Pro', android: '15.0', physical: true});
  for (const key of ['keyboardAndComposerVisible', 'sameConversationReopenRestoresDraft', 'physicalProcessRestartObserved',
    'signedOutObserved', 'providerUninstallAcknowledged', 'sessionEnded', 'hostClipboardRestored']) assert.equal(review[key], true, key);
  for (const key of ['draftRestoredAfterProcessRestart', 'phoneCorrectionAccepted', 'packageAbsenceIndependentlyVerified',
    'candidateInstrumentationExecuted', 'installedBytesIndependentlyAttested', 'realRadioLossAccepted', 'trackingAccepted',
    'actualMessageSendAccepted', 'peerPhoneAccepted', 'iOSAccepted', 'productionWrites', 'realPayments',
    'applicationDeployed', 'releaseAccepted']) assert.equal(review[key], false, key);
  assert.equal(review.mapsRequests, 0); assert.equal(review.publishedCaptureCount, 3);
  assert.equal(review.independentZeroMessageCheckpoints, 7); assert.equal(review.candidateInstrumentationCasesCompiled, 5);
  assert.equal(review.exactDraft, 'brouillon prive qa avant fermeture');
  assert.equal(review.captureKind, 'original-session-window-crops-not-native-exports');
  assert.deepEqual(review.captureClip, {x: 459, y: 110, width: 200, height: 435});
  assert.deepEqual(review.privateHelper, {ports: [5001, 8080, 9000, 9099], aliasEnabled: false, forceLocal: false, requestLoggingEnabled: false});
  for (const report of [before, stopped, after]) assert.equal(report.command, 'dumpsys meminfo be.sportgreenmoove.app.local');
  assert.equal(stopped.noProcessFound, true);
  assert(Number.isSafeInteger(before.pid) && before.pid > 0); assert(Number.isSafeInteger(after.pid) && after.pid > 0);
  assert.notEqual(before.pid, after.pid);
  assert(Date.parse(before.observedAt) < Date.parse(stopped.observedAt));
  assert(Date.parse(stopped.observedAt) < Date.parse(after.observedAt));
}

export function validateChatDraftPhone(root) {
  const folder = resolve(root, chatDraftPhoneFolder); assertEvidenceBundleChecksums(folder);
  const bytes = name => readFileSync(resolve(folder, name)), read = name => JSON.parse(bytes(name));
  const review = read('review.json');
  validateChatDraftPhoneReview(review, read('process-before.json'), read('process-stopped.json'), read('process-after.json'));
  assert(bytes('process-before-ax.txt').toString().includes(`MEMINFO in pid ${read('process-before.json').pid} [be.sportgreenmoove.app.local]`));
  assert(bytes('process-stopped-ax.txt').toString().includes('No process found for: be.sportgreenmoove.app.local'));
  const afterPids = [...bytes('process-after-ax.txt').toString().matchAll(/MEMINFO in pid\s+(\d+)\s+\[be\.sportgreenmoove\.app\.local\]/g)];
  assert.equal(Number(afterPids.at(-1)?.[1]), read('process-after.json').pid);
  const result = read('observer/results.json'), baseline = read('observer/baseline.json');
  assert.equal(result.completed, true); assert.equal(result.failed, false); assert.equal(result.projectId, 'demo-sgm-local-qa');
  assert.equal(result.scope, 'independent-unsent-chat-records-not-keyboard-or-draft-restoration-proof');
  assert.equal(result.runId, baseline.runId); assert.deepEqual(result.fixture, baseline.fixture);
  assert.deepEqual(result.checkpoints.map(row => row.phase),
    ['ready', 'conversation-open', 'draft-visible', 'conversation-reopened', 'process-stopped', 'process-reopened', 'signed-out']);
  for (const checkpoint of result.checkpoints) {
    assert.equal(checkpoint.zeroMessages, true); assert.equal(checkpoint.zeroNotifications, true);
    assert.equal(checkpoint.phoneUiProvenByObserver, false);
    const observation = read('observer/' + checkpoint.phase + '.json');
    assert.equal(observation.runId, result.runId); assert.deepEqual(observation.checkpoint, checkpoint);
    verifyChatNetworkPhoneCheckpoint('ready', baseline.state, observation.state, result.fixture);
  }
  assert.equal(result.adminClientClosed, true); assert.equal(result.firestoreClientTerminated, true);
  for (const field of ['productionWrites', 'realPayments', 'phoneUiProvenByObserver', 'processRestartProvenByObserver']) assert.equal(result[field], false);
  assert.equal(result.mapRequests, 0);
  assertRetainedSourceFiles(root, result.sourceFiles); assertRetainedSourceFiles(root, read('candidate-sources.json'));
  const disposal = read('disposal.json');
  for (const field of ['privateSessionAbsent', 'runtimeAbsent', 'helperDirectoryAbsent', 'helperGroupExitVerified']) assert.equal(disposal[field], true);
  assert.deepEqual(disposal.ports, {host: '127.0.0.1', ports: [9099, 8080, 9000, 5001], closed: true});
  assert.equal(read('apk-provenance.json').sha256, 'c7c6f2a4b806c20a81c646b8d3fa0f06087f03c28babf26c80e7f9e23f35b08b');
  const parser = new XMLParser({ignoreAttributes: false});
  for (const [name, count, field] of [['ConversationDraftStateTest', 9, 'localDraftUnitCasesPassed'],
    ['ConversationComposerStateTest', 7, 'existingComposerUnitCasesPassed'], ['TeamConversationDraftStateTest', 10, 'existingTeamDraftUnitCasesPassed']]) {
    const suite = parser.parse(bytes('units/' + name + '.xml').toString()).testsuite;
    assert.equal(suite['@_name'], 'be.sportgreenmoove.app.ui.' + name); assert.equal(Number(suite['@_tests']), count);
    assert.equal(review[field], count);
    for (const key of ['failures', 'errors', 'skipped']) assert.equal(Number(suite['@_' + key]), 0);
  }
  for (const name of ['01-draft-keyboard', '02-conversation-reopened', '03-restarted-empty']) {
    const image = imageSize(bytes('captures/' + name + '.png')); assert.equal(image.width, 200); assert.equal(image.height, 435);
  }
}

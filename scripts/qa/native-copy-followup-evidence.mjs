import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {assertEvidenceBundleChecksums} from './evidence-bundle-checksums.mjs';
import {assertSearchDepartureNativeCases} from './search-departure-native-cases.mjs';

export const nativeCopyFollowupFolder = 'docs/release/evidence/native-copy-5d69928-2026-10-31/';
export function validateNativeCopyFollowup(root) {
  const folder = resolve(root, nativeCopyFollowupFolder);
  const bytes = file => readFileSync(resolve(folder, file)), json = file => JSON.parse(bytes(file));
  assertEvidenceBundleChecksums(folder);
  const run = json('run.json'), review = json('review.json'), jobs = json('jobs.json').jobs;
  assert.equal(run.head_sha, '5d699283747c79f92483c994b3deccc7d32163f1');
  assert.equal(run.status, 'completed'); assert.equal(run.conclusion, 'failure');
  assert.equal(run.id, 41196576936); assert.equal(review.runId, run.id); assert.equal(review.sourceCommit, run.head_sha);
  assert.equal(jobs.find(row => row.id === review.jobId).conclusion, 'failure');
  const focused = jobs.filter(row => row.name.startsWith('Android focused safety UI tests /'));
  assert.equal(focused.length, 12); assert(focused.every(row => row.conclusion === 'success'));
  const artifact = json('artifact.json'); assert.equal(artifact.workflow_run.head_sha, run.head_sha);
  assert.equal(artifact.workflow_run.id, run.id); assert.equal(artifact.id, 13041841273);
  const replay = 'outputs/local-ui-evidence/0e9c8fd83120582833d7513ae2d0516b/';
  const members = {'ordinary-results.json': 'outputs/store-review-screenshots/ordinary-results.json',
    'restoration.json': 'outputs/store-review-screenshots/disposable-store-restore.json',
    'network-instrumentation.txt': replay + 'LocalChatNetworkFlowTest-instrumentation.txt',
    'network-ui.json': replay + 'local-chat-network-ui.json', 'primary-copy.json': replay + 'adb-pull-network-recovery.json',
    'sync-diagnostics.json': replay + 'adb-sync-network-recovery-diagnostics.json',
    'failure-cleanup-copy.json': replay + 'adb-pull-failure-cleanup.json'};
  assert.deepEqual(review.retainedMemberChecksums, Object.fromEntries(Object.entries(members)
    .map(([file, member]) => [member, createHash('sha256').update(bytes(file)).digest('hex')])));
  const ordinary = json('ordinary-results.json'); assertSearchDepartureNativeCases(ordinary);
  const transcript = bytes('network-instrumentation.txt').toString();
  assert.match(transcript, /sgm_installations_blocked=true/);
  assert.match(transcript, /be\.sportgreenmoove\.app\.ui\.LocalChatNetworkFlowTest:\./);
  assert.equal([...transcript.matchAll(/OK \(1 test\)/g)].length, 1);
  assert.doesNotMatch(transcript, /FAILURES|INSTRUMENTATION_FAILED|Process crashed/);
  const network = json('network-ui.json'); assert.equal(network.completed, true);
  assert.deepEqual(network.network.map(row => row.phase), ['before', 'cellular-ready', 'offline', 'restored']);
  for (const key of ['offlineSendUnconfirmed', 'offlineDraftRetained', 'recoveredSendConfirmed', 'replyReceived',
    'cellularRequestReleased', 'wifiRequestReleased']) assert.equal(network[key], true, key);
  const primary = json('primary-copy.json'); assert.equal(primary.completed, false); assert.equal(primary.status, 1);
  assert.equal(primary.phase, 'network-recovery'); assert.equal(primary.runId, network.runId);
  const diagnostics = json('sync-diagnostics.json');
  assert(diagnostics.observations.some(row => row.collected === false && /device offline/.test(row.stderr)));
  assert.equal(json('failure-cleanup-copy.json').completed, true);
  assert.equal(json('restoration.json').verified, true);
  for (const key of ['archiveDigestIndependentlyVerified', 'fullReplayResultPresent', 'primaryCopyAccepted',
    'failureCleanupReplacesPrimary', 'fullNativeGateAccepted', 'storedChatRecordsVerified', 'offlineChatSequenceAccepted',
    'priorPreparationFailureCauseEstablished', 'copyFailureRootCauseEstablished', 'physicalPhoneAccepted',
    'productionWrites', 'releaseAccepted']) assert.equal(review[key], false, key);
  return {fullNativeGateAccepted: false, networkInstrumentationPassed: true, primaryCopyAccepted: false};
}

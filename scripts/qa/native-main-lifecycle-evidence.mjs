import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync, readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {parseAndroidJUnitTranscript} from './android-junit-transcript.mjs';
import {assertInstrumentationPassed} from './android-instrumentation-result.mjs';
import {assertChatNetworkReceipt, assertTransportRequestSetup} from './chat-network-evidence.mjs';
import {assertNetworkStartReceipt} from './network-start-evidence.mjs';
import {assertRetainedSourceFiles} from './retained-source-evidence.mjs';

export function validateLifecycleNativeMain(root, folder) {
  const base = resolve(folder, 'native-main'), bytes = file => readFileSync(resolve(base, file)), json = file => JSON.parse(bytes(file));
  const run = json('run.json'), jobs = json('jobs.json').jobs, artifact = json('artifact.json');
  assert.equal(run.id, 41199832039); assert.equal(run.head_sha, '5fa6fc49f73d3b1f4523ee77bd8c818a4d5368dc');
  assert.equal(run.status, 'completed'); assert.equal(run.conclusion, 'failure');
  assert.equal(jobs.find(row => row.id === 124533274682).conclusion, 'success');
  assert.equal(jobs.find(row => row.id === 124533274943).conclusion, 'failure');
  assert.equal(jobs.find(row => row.id === 124536458191).conclusion, 'failure');
  const focused = jobs.filter(row => row.name.startsWith('Android focused safety UI tests / Isolated ') && !row.name.endsWith(' / Isolated safety flows'));
  assert.equal(focused.length, 11); assert.equal(focused.filter(row => row.conclusion === 'success').length, 10);
  assert.equal(artifact.id, 13042653847); assert.equal(artifact.workflow_run.id, run.id); assert.equal(artifact.workflow_run.head_sha, run.head_sha);
  const ordinary = parseAndroidJUnitTranscript(bytes('ordinary-instrumentation.txt').toString());
  for (const [key, value] of Object.entries(ordinary)) assert.deepEqual(json('ordinary-results.json')[key], value);
  assert.equal(ordinary.passed, 214); assert.equal(ordinary.skipped, 54); assert.equal(ordinary.failed, 0);
  assert.equal(json('ordinary-results.json').guardConfirmed, true); assert.equal(json('ordinary-process.json').status, 0);
  const replay = json('replay/results.json'); assert.equal(replay.scope, 'local-ui-not-physical-device');
  assert.equal(replay.projectId, 'demo-sgm-local-qa'); assert.equal(replay.runId, 'e35ae282489da449e7a602ca35c1ceec');
  assert.equal(replay.testCount, 37); assert.equal(replay.nativeCaseCount, 40);
  const prior = JSON.parse(readFileSync(resolve(root, 'docs/release/evidence/native-timeout-9abc639-2026-10-30/following-main/results.json')));
  assert.deepEqual(replay.steps, prior.steps); assert(replay.steps.every(row => row.status === 'passed'));
  assert.equal(replay.adminClientClosed, true); assert.equal(replay.firestoreClientTerminated, true);
  const names = readdirSync(resolve(base, 'replay')), transcripts = names.filter(file => file.endsWith('-instrumentation.txt'));
  assert.equal(transcripts.length, 32); let count = 0;
  for (const file of transcripts) {
    const cases = file.startsWith('LocalAppFlowTest-') ? 9 : 1;
    assertInstrumentationPassed(bytes('replay/' + file).toString(), cases); count += cases;
  }
  assert.equal(count, 40);
  const copies = names.filter(file => file.startsWith('adb-pull-')); assert.equal(copies.length, 17);
  for (const file of copies) {
    const copy = json('replay/' + file); assert.equal(copy.runId, replay.runId);
    assert.equal(copy.completed, true); assert.equal(copy.status, 0); assert.equal(copy.signal, null); assert.equal(copy.errorCode, null);
    assert.equal(file, 'adb-pull-' + copy.phase + '.json'); assert.notEqual(copy.phase, 'failure-cleanup');
  }
  assert.deepEqual(json('native-suite-status.json'), {scope: 'native-suite-exit-status-not-flow-verification', ordinaryTests: 0, componentEvidence: 0, localReplay: 0});
  assert.equal(replay.matrixPreparation.receiptSha256, createHash('sha256').update(bytes('device-setup.json')).digest('hex'));
  assert.deepEqual(replay.matrixPreparation.apkHashes, json('device-setup.json').apkHashes);
  assert.equal(replay.matrixPreparation.installationsRemainedBlocked, true);
  const restore = json('device-restore.json'); assert.equal(restore.verified, true); assert.equal(restore.restored, true);
  for (const key of ['localPackagesRemoved', 'background', 'stopped', 'launcher']) assert.equal(restore.restoration[key], true);
  for (const key of ['authorizationRemoved', 'componentRemoved', 'originalPolicyRestored']) assert.equal(restore.restoration.installAdmin[key], true);
  const network = json('replay/local-chat-network-ui.json'); assert.equal(network.runId, replay.runId);
  assertChatNetworkReceipt(network); assertTransportRequestSetup(network); assertNetworkStartReceipt(network);
  assert.equal(replay.chatNetwork.messageCount, 2); assert.equal(replay.chatNetwork.notificationCount, 2); assert.equal(replay.chatNetwork.duplicateMessages, 0);
  const failure = json('failed-boot-log.json'); assert.equal(failure.jobId, 124533274943);
  assert.equal(failure.message, 'Timeout waiting for emulator to boot.'); assert.equal(failure.applicationCaseReached, false);
  assert.equal(failure.rootCauseConfirmed, false); assert.equal(failure.rawLogPublished, false);
  assertRetainedSourceFiles(root, json('source-sha256.json'));
  return {groups: 37, nativeCases: 40, primaryCopies: 17, wholeWorkflowAccepted: false};
}

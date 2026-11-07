import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync, readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {assertEvidenceBundleChecksums} from './evidence-bundle-checksums.mjs';
import {parseAndroidJUnitTranscript} from './android-junit-transcript.mjs';
import {assertInstrumentationPassed} from './android-instrumentation-result.mjs';

export const c84ChecksFolder = 'docs/release/evidence/checks-c84b8e4-2026-11-02/';
export const c84ChecksSource = 'c84b8e4a96f2f35d0b92f68b13904740b14d0dd3';
export function assertC84ChecksScope(review) {
  assert.equal(review.scope, 'source-bound-main-pass-with-network-preparation-failure-and-web-finalization-incomplete');
  assert.equal(review.sourceCommit, c84ChecksSource); assert.equal(review.nativeMainPassed, true);
  for (const key of ['wholeNativeGatePassed', 'wholeWebGatePassed', 'chatNetworkFlowPassed', 'webFinalizationCauseProven',
    'captureIntermittencyRepaired', 'parentApprovalProven', 'physicalTrackingAccepted', 'releaseAccepted', 'productionWrites'])
    assert.equal(review[key], false, key);
  assert.deepEqual(review.publishedMedia, []);
}
export function validateC84Checks(root) {
  const folder = resolve(root, c84ChecksFolder), bytes = name => readFileSync(resolve(folder, name));
  const json = name => JSON.parse(bytes(name)); assertEvidenceBundleChecksums(folder);
  const review = json('review.json'); assertC84ChecksScope(review);
  const native = json('native-run.json'), web = json('web-run.json');
  for (const [run, id, conclusion] of [[native, 41531744223, 'failure'], [web, 41531744084, 'cancelled']]) {
    assert.equal(run.id, id); assert.equal(run.head_sha, c84ChecksSource);
    assert.equal(run.run_attempt, 1); assert.equal(run.status, 'completed'); assert.equal(run.conclusion, conclusion);
  }
  const jobs = json('native-jobs.json').jobs, webJobs = json('web-jobs.json').jobs;
  const job = (rows, id) => {const matches = rows.filter(row => row.id === id); assert.equal(matches.length, 1); return matches[0];};
  for (const row of [...jobs, ...webJobs]) {assert.equal(row.head_sha, c84ChecksSource); assert.equal(row.status, 'completed');}
  assert.equal(job(jobs, 125573411082).conclusion, 'success');
  assert.equal(job(jobs, 125573410973).conclusion, 'failure');
  assert.equal(job(jobs, 125579192058).conclusion, 'failure');
  const focused = jobs.filter(row => row.name.startsWith('Android focused safety UI tests / Isolated ') && !row.name.endsWith(' safety flows'));
  assert.equal(focused.length, 11); assert.equal(focused.filter(row => row.conclusion === 'success').length, 10);
  const webMain = job(webJobs, 125573409996); assert.equal(webMain.conclusion, 'cancelled');
  assert(webMain.steps.length > 140); assert(webMain.steps.every(row => row.conclusion === 'success'));
  assert.equal(job(webJobs, 125588527240).conclusion, 'failure');
  const checks = json('head-checks.json').check_runs; assert.equal(checks.length, 30);
  for (const row of checks) {assert.equal(row.head_sha, c84ChecksSource); assert.equal(row.status, 'completed');}
  assert.equal(checks.filter(row => row.conclusion === 'failure').length, 3);
  assert.equal(checks.filter(row => row.conclusion === 'cancelled').length, 1);
  assert.equal(checks.filter(row => row.conclusion === 'skipped').length, 6);
  assert.equal(checks.filter(row => row.conclusion === 'success').length, 20);
  const ordinary = parseAndroidJUnitTranscript(bytes('main/ordinary-instrumentation.txt').toString());
  assert.equal(ordinary.passed, 248); assert.equal(ordinary.skipped, 55); assert.equal(ordinary.failed, 0);
  for (const [key, value] of Object.entries(ordinary)) assert.deepEqual(json('main/ordinary-results.json')[key], value);
  const status = json('main/native-suite-status.json');
  for (const key of ['ordinaryTests', 'componentEvidence', 'localReplay']) assert.equal(status[key], 0);
  const replay = json('main/replay/results.json'); assert.equal(replay.scope, 'local-ui-not-physical-device');
  assert.equal(replay.testCount, 37); assert.equal(replay.nativeCaseCount, 40); assert.equal(replay.steps.length, 37);
  assert(replay.steps.every(row => row.status === 'passed')); assert.equal(replay.adminClientClosed, true);
  assert.equal(replay.firestoreClientTerminated, true);
  const files = readdirSync(resolve(folder, 'main/replay'));
  const transcripts = files.filter(file => file.endsWith('-instrumentation.txt')); assert.equal(transcripts.length, 32);
  for (const file of transcripts) assertInstrumentationPassed(bytes('main/replay/' + file).toString(), file.startsWith('LocalAppFlowTest-') ? 9 : 1);
  const copies = files.filter(file => file.startsWith('adb-pull-')); assert.equal(copies.length, 17);
  for (const file of copies) {
    const copy = json('main/replay/' + file); assert.equal(copy.runId, replay.runId);
    assert.equal(copy.completed, true); assert.equal(copy.status, 0); assert.equal(copy.signal, null);
    assert.equal(copy.errorCode, null); assert.notEqual(copy.phase, 'failure-cleanup');
  }
  assert.equal(json('chat/status.json').status, 1);
  assert.match(bytes('chat/LocalChatNetworkFlowTest-instrumentation.txt').toString(), /LocalChatNetworkFlowTest\.kt:83/);
  const chat = json('chat/local-chat-network-ui.json'); assert.equal(chat.completed, false);
  assert.equal(chat.failedPhase, 'network-preparation'); assert.deepEqual(chat.network, []);
  for (const phase of ['initialNetwork', 'preparation', 'preparationFailure']) {
    assert.equal(chat[phase].hasDefaultDataSubscription, false); assert.equal(chat[phase].backendReachable, true);
  }
  assert.equal(chat.cellularRequestReleased, true); assert.equal(chat.wifiRequestReleased, true);
  for (const path of ['main/', 'chat/']) {
    const restore = json(path + (path === 'main/' ? 'disposable-store-restore.json' : 'restoration.json'));
    assert.equal(restore.restored, true); assert.equal(restore.verified, true);
    assert.equal(restore.restoration.localPackagesRemoved, true);
    for (const key of ['authorizationRemoved', 'componentRemoved', 'originalPolicyRestored']) assert.equal(restore.restoration.installAdmin[key], true);
    const exit = json(path + 'host-exit.json'); assert.equal(exit.finalState, 'gone'); assert.equal(exit.targetExitObserved, true);
  }
  const boundary = json('web-log-boundary.json'); assert.equal(boundary.jobId, webMain.id);
  assert.match(boundary.finalLine, /^2026-11-02T22:11:18\.7835144Z Cleaning up orphan processes$/);
  for (const key of ['logsProveFinalizationRootCause', 'sourceWorkloadFailed', 'wholeJobAccepted']) assert.equal(boundary[key], false);
  assert(json('web-annotations.json').some(row => row.annotation_level === 'failure' && row.message === 'The job has exceeded the maximum execution time of 30m0s'));
  const artifacts = json('artifacts.json'), provenance = json('archive-verification.json');
  assert.equal(provenance.completeZipDigestsVerified, true); assert.equal(artifacts.length, 2);
  for (const [i, id, size, digest] of [[0, 13182974329, 25346957, 'bcf6d2430dcd72cddfd170726a21da3deb8a0e4a0900ad98a9796c93fdde9966'],
    [1, 13182213813, 372648, 'c81bdb840ccc34625fe56941d799297c914ebd456de3897b26015b24cd526620']]) {
    const artifact = artifacts[i]; assert.equal(artifact.id, id); assert.equal(artifact.size_in_bytes, size);
    assert.equal(artifact.digest, 'sha256:' + digest); assert.equal(artifact.workflow_run.head_sha, c84ChecksSource);
  }
  const retained = readdirSync(folder, {recursive: true, withFileTypes: true}).filter(row => row.isFile())
    .map(row => resolve(row.parentPath, row.name).slice(folder.length + 1)).filter(file => /^(?:main|chat)\//.test(file));
  assert.deepEqual(Object.keys(provenance.members).sort(), retained.sort());
  for (const [file, member] of Object.entries(provenance.members)) {
    assert(artifacts.some(row => row.id === member.artifactId)); assert(!member.member.includes('..'));
    assert.equal(createHash('sha256').update(bytes(file)).digest('hex'), member.sha256, file);
  }
  return {nativeMainPassed: true, wholeNativeGatePassed: false, wholeWebGatePassed: false, releaseAccepted: false};
}

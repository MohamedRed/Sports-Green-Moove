import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync, readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {assertEvidenceBundleChecksums} from './evidence-bundle-checksums.mjs';
import {assertRetainedSourceFiles} from './retained-source-evidence.mjs';
import {parseAndroidJUnitTranscript} from './android-junit-transcript.mjs';
import {assertInstrumentationPassed} from './android-instrumentation-result.mjs';
import {validatePrimaryCaptureDiagnostic} from './primary-capture-diagnostic-schema.mjs';
import {focusedCases} from './android-case-apks.mjs';

export const completeChecksFolder = 'docs/release/evidence/complete-checks-638066c-2026-11-02/';
export const completeChecksSource = '638066cc697047a6c5a159f27f89ec448a5f068e';
export function assertCompleteChecksReview(review) {
  assert.equal(review.scope, 'source-specific-complete-automated-checks-not-intermittency-repair-or-physical-release');
  for (const [key, value] of Object.entries({sourceCommit: completeChecksSource, nativeRun: 41438000520,
    nativeJob: 125252512809, nativeArtifact: 13141272714, webRun: 41438000498,
    ordinaryPassed: 248, ordinarySkipped: 55, ordinaryFailed: 0, replayGroups: 37, replayNativeCases: 40,
    primaryCopies: 17, focusedJobs: 11, hostedPassed: 24, hostedSkipped: 5})) assert.equal(review[key], value, key);
  assert.equal(review.sourceSpecificFullGatePassed, true);
  for (const key of ['currentHeadGateAccepted', 'physicalDeviceAccepted', 'productionWrites', 'releaseAccepted',
    'earlierFailureRepaired', 'underlyingCauseConfirmed', 'signupPhoneAccepted']) assert.equal(review[key], false, key);
  assert.deepEqual(review.publishedMedia, []);
}
export function validateCompleteChecks(root) {
  const folder = resolve(root, completeChecksFolder), bytes = file => readFileSync(resolve(folder, file));
  const json = file => JSON.parse(bytes(file)); assertEvidenceBundleChecksums(folder);
  const sha = data => createHash('sha256').update(data).digest('hex');
  const review = json('review.json'); assertCompleteChecksReview(review);
  const native = json('native-run.json'), web = json('web-run.json');
  for (const [run, id] of [[native, review.nativeRun], [web, review.webRun]]) {
    assert.equal(run.id, id); assert.equal(run.head_sha, completeChecksSource);
    assert.equal(run.status, 'completed'); assert.equal(run.conclusion, 'success');
  }
  const skipped = ['iOS native UI tests', 'iOS native checks', 'Android approved real-map UI integration',
    'Android approved vehicle-map UI', 'Android approved parent search and booking'];
  const jobs = json('native-jobs.json').jobs; assert.equal(jobs.length, 20);
  for (const row of jobs) {
    assert.equal(row.head_sha, completeChecksSource); assert.equal(row.run_id, native.id);
    assert.equal(row.status, 'completed'); assert.equal(row.conclusion, skipped.includes(row.name) ? 'skipped' : 'success');
  }
  assert.equal(jobs.find(row => row.id === review.nativeJob)?.name, 'Android native UI tests');
  for (const name of focusedCases) assert.equal(jobs.filter(row => row.name === 'Android focused safety UI tests / Isolated ' + name).length, 1);
  const webJobs = json('web-jobs.json').jobs; assert.equal(webJobs.length, 4);
  for (const row of webJobs) {
    assert.equal(row.run_id, web.id); assert.equal(row.head_sha, completeChecksSource);
    assert.equal(row.status, 'completed'); assert.equal(row.conclusion, 'success');
  }
  assert.deepEqual(webJobs.map(row => row.name).sort(), ['Functions, admin, and website checks',
    'Functions, admin, and website smoke', 'People and safety service smoke', 'Guardian, child, and tracking service smoke'].sort());
  const checks = json('head-checks.json').check_runs; assert.equal(checks.length, 29);
  assert.equal(checks.filter(row => row.conclusion === 'success').length, 24);
  assert.deepEqual(checks.filter(row => row.conclusion === 'skipped').map(row => row.name).sort(), skipped.sort());
  for (const row of checks) {assert.equal(row.head_sha, completeChecksSource); assert.equal(row.status, 'completed');}
  for (const name of ['Android native UI tests', 'Functions and Firebase rules', 'Functions, admin, and website smoke',
    'Production provider secret validation', 'Store readiness static checks']) assert.equal(checks.filter(row => row.name === name && row.conclusion === 'success').length, 1);
  const artifact = json('native-artifact.json'), archive = json('archive-verification.json');
  assert.equal(artifact.id, review.nativeArtifact); assert.equal(artifact.workflow_run.head_sha, completeChecksSource);
  assert.equal(artifact.workflow_run.id, native.id); assert.equal(archive.sha256, artifact.digest.slice('sha256:'.length));
  assert.equal(archive.bytes, artifact.size_in_bytes); assert.equal(archive.originalArchivePublished, false);
  const mainFiles = readdirSync(resolve(folder, 'main'), {recursive: true, withFileTypes: true}).filter(row => row.isFile())
    .map(row => resolve(row.parentPath, row.name).slice(folder.length + 1)).sort();
  assert.deepEqual(Object.keys(archive.members).sort(), mainFiles, 'Every retained primary artifact must have original ZIP provenance');
  for (const [path, entry] of Object.entries(archive.members)) {
    assert.equal(sha(bytes(path)), entry.sha256, path); assert(entry.member.startsWith('outputs/'));
  }
  const ordinary = parseAndroidJUnitTranscript(bytes('main/ordinary-instrumentation.txt').toString());
  assert.equal(ordinary.passed, 248); assert.equal(ordinary.skipped, 55); assert.equal(ordinary.failed, 0);
  for (const [key, value] of Object.entries(ordinary)) assert.deepEqual(json('main/ordinary-results.json')[key], value);
  assert.equal(json('main/ordinary-process.json').status, 0);
  assert.deepEqual(json('main/native-suite-status.json'), {scope: 'native-suite-exit-status-not-flow-verification', ordinaryTests: 0, componentEvidence: 0, localReplay: 0});
  const replay = json('main/replay/results.json'); assert.equal(replay.scope, 'local-ui-not-physical-device');
  assert.equal(replay.testCount, 37); assert.equal(replay.nativeCaseCount, 40); assert.equal(replay.steps.length, 37);
  assert(replay.steps.every(row => row.status === 'passed'));
  const prior = JSON.parse(readFileSync(resolve(root, 'docs/release/evidence/full-native-5091ec5-2026-10-31/main/replay/results.json')));
  assert.deepEqual(replay.steps, prior.steps);
  assert.equal(replay.adminClientClosed, true); assert.equal(replay.firestoreClientTerminated, true);
  const files = readdirSync(resolve(folder, 'main/replay')), transcripts = files.filter(file => file.endsWith('-instrumentation.txt'));
  assert.equal(transcripts.length, 32); let cases = 0;
  for (const file of transcripts) {const count = file.startsWith('LocalAppFlowTest-') ? 9 : 1;
    assertInstrumentationPassed(bytes('main/replay/' + file).toString(), count); cases += count;}
  assert.equal(cases, 40);
  const copies = files.filter(file => file.startsWith('adb-pull-')); assert.equal(copies.length, 17);
  for (const file of copies) {
    const row = json('main/replay/' + file); assert.equal(row.runId, replay.runId);
    assert.equal(row.completed, true); assert.equal(row.status, 0); assert.equal(row.signal, null); assert.equal(row.errorCode, null);
    assert.equal(file, 'adb-pull-' + row.phase + '.json'); assert.notEqual(row.phase, 'failure-cleanup');
  }
  const setup = json('main/disposable-device-setup.json'), restore = json('main/disposable-store-restore.json');
  assert.equal(replay.matrixPreparation.receiptSha256, sha(bytes('main/disposable-device-setup.json')));
  assert.deepEqual(replay.matrixPreparation.apkHashes, setup.apkHashes);
  assert.equal(replay.matrixPreparation.installationsRemainedBlocked, true);
  assert.equal(restore.restored, true); assert.equal(restore.verified, true);
  for (const key of ['localPackagesRemoved', 'background', 'stopped', 'launcher']) assert.equal(restore.restoration[key], true, key);
  for (const key of ['authorizationRemoved', 'componentRemoved', 'originalPolicyRestored']) assert.equal(restore.restoration.installAdmin[key], true, key);
  const capture = json('main/parent-accepted-capture.json'); assert.equal(validatePrimaryCaptureDiagnostic(capture).complete, true);
  assert.equal(capture.primaryOutcome, 'returned'); assert.equal(capture.sdkInvocations, 1);
  const failed = json('previous/parent-accepted-capture.json'); assert.equal(validatePrimaryCaptureDiagnostic(failed).complete, false);
  assert.equal(failed.primaryOutcome, 'threw'); assert.equal(failed.errorCategory, 'pixelcopy-callback-wait');
  assert.equal(failed.observerTerminationVerified, false); assert.equal(failed.sdkInvocations, 1);
  const failedTranscript = parseAndroidJUnitTranscript(bytes('previous/ordinary-instrumentation.txt').toString());
  assert.equal(failedTranscript.passed, 247); assert.equal(failedTranscript.failed, 1); assert.equal(failedTranscript.skipped, 55);
  assert.equal(json('previous/native-job.json').conclusion, 'failure');
  const previousArtifact = json('previous/native-artifact.json'), previousArchive = json('previous/archive-verification.json');
  assert.equal(previousArtifact.id, 13125998473); assert.equal(previousArtifact.workflow_run.id, 41409493368);
  assert.equal(previousArtifact.workflow_run.head_sha, 'd55a112b129f8bf5bfe0bff0f21a929dc9da2596');
  assert.equal(previousArchive.sha256, previousArtifact.digest.slice('sha256:'.length));
  assert.equal(previousArchive.bytes, previousArtifact.size_in_bytes);
  assert.deepEqual(Object.keys(previousArchive.members).sort(), ['previous/ordinary-instrumentation.txt', 'previous/parent-accepted-capture.json']);
  for (const [file, entry] of Object.entries(previousArchive.members)) assert.equal(sha(bytes(file)), entry.sha256, file);
  assertRetainedSourceFiles(root, json('source-files.json'));
  return {sourceSpecificFullGatePassed: true, ordinaryPassed: 248, replayGroups: 37, replayNativeCases: 40,
    primaryCopies: 17, focusedJobs: 11, physicalDeviceAccepted: false, intermittencyRepaired: false, releaseAccepted: false};
}

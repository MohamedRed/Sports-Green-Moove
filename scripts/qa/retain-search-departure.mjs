import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync} from 'node:fs';
import {dirname, isAbsolute, resolve} from 'node:path';
import {assertSearchDepartureNativeCases, searchDepartureArchiveMembers, searchDepartureCandidate} from './search-departure-native-cases.mjs';

const input = process.argv[2]; assert.equal(process.argv.length, 3); assert(isAbsolute(input ?? ''));
const root = resolve(import.meta.dirname, '../..');
const trial = '/Users/mrr/.codex/sgm-native-comparison-20261030/search-departure-trial';
const resumed = resolve(trial, 'resumed-20261031');
const destination = resolve(root, 'docs/release/evidence/search-departure-2026-10-31');
assert(!existsSync(destination), 'Retained attempts are immutable');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const gh = path => JSON.parse(execFileSync('gh', ['api', 'repos/MohamedRed/Sports-Green-Moove/' + path],
  {encoding: 'utf8', timeout: 30_000, maxBuffer: 4 * 1024 * 1024}));
const run = gh('actions/runs/41193370066'), job = gh('actions/jobs/124514507012');
assert.equal(run.head_sha, searchDepartureCandidate); assert.equal(run.status, 'completed');
assert.equal(job.head_sha, searchDepartureCandidate); assert.equal(job.status, 'completed');
const superseded = [[41191055063, 124507757171, '8e0b1c5ceeb25145a4ecbb36985c03ae55086a76'],
  [41192580807, 124512188895, 'e87238d9632e4cb68c80528117dd6a4faeebdefe'],
  [41192836560, 124512961780, '4e15431cccbfb9df616776c069daa4ffa3dc9ef0']].map(([runId, jobId, sourceCommit]) => {
  const previousRun = gh('actions/runs/' + runId), previousJob = gh('actions/jobs/' + jobId);
  for (const row of [previousRun, previousJob]) {
    assert.equal(row.head_sha, sourceCommit); assert.equal(row.status, 'completed'); assert.equal(row.conclusion, 'cancelled');
  }
  return {run: previousRun, job: previousJob, sourceCommit, cancellationRequestedByAgent: true, accepted: false};
});
const artifact = JSON.parse(readFileSync(resolve(input, 'artifact.json')));
assert.equal(artifact.name, 'android-connected-ui-test-results'); assert.equal(artifact.expired, false);
assert.equal(artifact.workflow_run.head_sha, searchDepartureCandidate); assert.equal(artifact.workflow_run.id, run.id);
const zip = resolve(input, 'original-artifact.zip'), zipBytes = readFileSync(zip);
assert.equal(sha(zipBytes), artifact.digest.slice('sha256:'.length)); assert.equal(zipBytes.length, artifact.size_in_bytes);
const member = 'outputs/store-review-screenshots/ordinary-results.json';
const ordinary = execFileSync('unzip', ['-p', zip, member], {maxBuffer: 6 * 1024 * 1024});
const selected = assertSearchDepartureNativeCases(JSON.parse(ordinary));
const output = mkdtempSync(resolve(dirname(destination), '.search-departure-stage-'));
try {
for (const folder of ['before', 'candidate', 'final', 'native/chat-network', 'original-attempt', 'phone', 'phone/captures', 'preparation/local'])
  mkdirSync(resolve(output, folder), {recursive: true});
const files = [];
const save = (path, value) => {writeFileSync(resolve(output, path), value, {flag: 'wx'}); files.push(path);};
const json = (path, value) => save(path, JSON.stringify(value, null, 2) + '\n');
const copy = (from, to) => save(to, readFileSync(from));
const archive = (path, bytes, digest) => {
  assert.equal(sha(bytes), digest, path);
  const target = resolve(root, 'docs/release/evidence/source-archive', digest + '.txt');
  if (existsSync(target)) assert.deepEqual(readFileSync(target), bytes); else writeFileSync(target, bytes, {flag: 'wx'});
};
for (const [stage, destination] of [['before', 'before'], ['after', 'candidate']]) {
  const sources = JSON.parse(readFileSync(resolve(trial, stage, 'source-sha256.json')));
  json(destination + '/source-sha256.json', sources);
  for (const [path, digest] of Object.entries(sources)) archive(path,
    readFileSync(resolve(trial, stage, stage === 'before' ? path.split('/').at(-1) + '.txt' : digest + '.txt')), digest);
}
copy(resolve(trial, 'before/review.json'), 'before/review.json');
for (const [from, to] of [['after/build.txt', 'candidate/build.txt'], ['after/SearchDepartureInputTest.xml', 'candidate/units.xml'],
  ['after/apk.json', 'candidate/apk.json'], ['preparation/initial-build.txt', 'preparation/initial-build.txt'],
  ['preparation/initial-picker-helper.kt.txt', 'preparation/initial-picker-helper.kt.txt'],
  ['preparation/helper-corrected-build.txt', 'preparation/helper-corrected-build.txt'],
  ['preparation/interrupted-phone-trial.json', 'original-attempt/interruption.json'],
  ['records/baseline.json', 'original-attempt/baseline.json'], ['records/before.json', 'original-attempt/before.json']])
  copy(resolve(trial, from), to);
copy('/private/tmp/sgm-search-departure-cancellation-build-20261031.txt', 'final/build.txt');
copy('/private/tmp/sgm-search-departure-scroll-host-build-20261031.txt', 'preparation/scroll-host-build.txt');
copy('/private/tmp/sgm-search-departure-identifiers-build-20261031.txt', 'preparation/identifier-build.txt');
copy(resolve(root, 'android/app/build/test-results/testDebugUnitTest/TEST-be.sportgreenmoove.app.ui.SearchDepartureInputTest.xml'), 'final/units.xml');
const finalPaths = Object.keys(JSON.parse(readFileSync(resolve(trial, 'after/source-sha256.json'))));
const finalSources = Object.fromEntries(finalPaths.map(path => {
  const bytes = execFileSync('git', ['show', searchDepartureCandidate + ':' + path], {cwd: root});
  assert.deepEqual(readFileSync(resolve(root, path)), bytes); const digest = sha(bytes); archive(path, bytes, digest); return [path, digest];
}));
json('final/source-sha256.json', finalSources);
for (const previous of superseded) {
  const manifest = Object.fromEntries(finalPaths.map(path => {
    const bytes = execFileSync('git', ['show', previous.sourceCommit + ':' + path], {cwd: root});
    const digest = sha(bytes); archive(path, bytes, digest); return [path, digest];
  }));
  previous.sourceFiles = manifest;
}
json('preparation/superseded-ci.json', superseded);
const firstFolder = resolve(input, 'initial'), firstArtifact = JSON.parse(readFileSync(resolve(firstFolder, 'artifact.json')));
const firstZip = resolve(firstFolder, 'original-artifact.zip'), firstZipBytes = readFileSync(firstZip);
assert.equal(firstArtifact.workflow_run.id, superseded[0].run.id);
assert.equal(firstArtifact.workflow_run.head_sha, superseded[0].sourceCommit);
assert.equal(firstArtifact.digest, 'sha256:' + sha(firstZipBytes)); assert.equal(firstArtifact.size_in_bytes, firstZipBytes.length);
const initialMembers = {};
for (const file of ['ordinary-instrumentation.txt', 'ordinary-process.json']) {
  const path = 'outputs/store-review-screenshots/' + file;
  const value = execFileSync('unzip', ['-p', firstZip, path], {maxBuffer: 16 * 1024 * 1024});
  save('preparation/initial-' + file, value); initialMembers[path] = sha(value);
}
json('preparation/initial-artifact.json', firstArtifact);
json('preparation/initial-selection.json', {archiveRetainedPrivately: true, members: initialMembers, accepted: false});
const local = '/Users/mrr/.codex/sgm-native-comparison-20261031/search-departure-local';
for (const file of ['instrumentation.txt', 'stderr.txt', 'process.json', 'apk-sha256.json', 'source-sha256.json',
  'store-pause.json', 'store-restoration.json', 'closure.json', 'disposal.json']) copy(resolve(local, file), 'preparation/local/' + file);
copy(resolve(local, 'run.mjs'), 'preparation/local/runner.mjs.txt');
for (const file of ['records/baseline.json', 'records/before.json', 'records/results.json', 'failure-state.json',
  'phone-disposal.json', 'uninstall-observation.json', 'disposal.json', 'captures/auth-timeout-session.jpg',
  'captures/auth-timeout.png', 'captures/auth-timeout-capture.json', 'captures/uninstall-session.jpg'])
  copy(resolve(resumed, file), 'phone/' + file.replace('records/', ''));
for (const file of ['initial-state-check.json', 'initial-state-check-source.mjs.txt'])
  copy(resolve(resumed, 'preparation', file), 'preparation/' + file);
for (const file of ['phone/results.json', 'phone/failure-state.json']) {
  const report = JSON.parse(readFileSync(resolve(output, file)));
  for (const [path, digest] of Object.entries(report.sourceFiles)) archive(path, readFileSync(resolve(root, path)), digest);
}
json('native/run.json', run); json('native/job.json', job); json('native/artifact.json', artifact);
json('native/jobs.json', gh('actions/runs/' + run.id + '/jobs?per_page=100'));
const members = {};
for (const [file, memberPath] of Object.entries(searchDepartureArchiveMembers)) {
  const value = execFileSync('unzip', ['-p', zip, memberPath], {maxBuffer: 16 * 1024 * 1024});
  save('native/' + file, value); members[memberPath] = sha(value);
}
const archiveNames = execFileSync('unzip', ['-Z1', zip], {encoding: 'utf8'}).trim().split('\n');
assert(!archiveNames.includes('outputs/local-ui-evidence/31c53c811db40113e924455179fd1834/results.json'));
const replaySources = Object.fromEntries(['LocalChatNetworkFlowTest.kt', 'LocalEmulatorNetwork.kt',
  'LocalInitialNetworkObservation.kt', 'LocalRequestedTransport.kt'].map(name => {
  const path = 'android/app/src/androidTest/java/be/sportgreenmoove/app/ui/' + name;
  const bytes = execFileSync('git', ['show', searchDepartureCandidate + ':' + path], {cwd: root});
  const digest = sha(bytes); archive(path, bytes, digest); return [path, digest];
}));
json('native/replay-source-sha256.json', replaySources);
json('native/selection.json', {archiveSha256: sha(zipBytes), archiveRetainedPrivately: true,
  selectedMemberComparedByteForByte: true, fullReplayResultMemberAbsent: true, members, cases: selected});
json('review.json', {scope: 'search-date-time-component-ui-and-failed-physical-auth-not-complete-search-or-release',
  reviewedAt: '2026-10-31', sourceCommit: searchDepartureCandidate, nativeRunId: run.id, nativeJobId: job.id,
  nativeWorkflowSucceeded: run.conclusion === 'success', nativeMainJobSucceeded: job.conclusion === 'success',
  supersededRunsAccepted: false,
  fullNativeGateAccepted: false, offlineChatSequenceAccepted: false, networkPreparationCauseEstablished: false,
  unitCasesPassed: 10, newNativeCasesPassed: 9, migratedNativeCasesPassed: 2,
  supplementalLocalNativeCasesPassed: 11, supplementalLocalGuardConfirmed: false,
  phoneAuthenticationObservation: {visibleMessage: 'E-mail ou mot de passe incorrect.',
    originalCapturePhase: 'authentication-timeout-before-calendar', originalLabelIsDiagnosis: false,
    underlyingErrorCodeObserved: false, typedSecretIndependentlyVerified: false},
  physicalDateChoiceAccepted: false, physicalSearchRecoveryAccepted: false, physicalBookingRecoveryAccepted: false,
  authenticationFailureCauseEstablished: false, authenticationTimeoutEstablished: false, previousCaptureFailureRepaired: false,
  iOSUiAccepted: false, realMapsExercised: false, realPaymentsExercised: false, productionWrites: false,
  screenReaderAccepted: false, releaseAccepted: false, mapRequests: 0, publishedCaptures: [],
  privateHelperScope: {ports: [5001, 8080, 9000, 9099], forceLocal: false, aliasEnabled: false,
    invitationPagePortEnabled: false, requestLoggingEnabled: false}});
json('artifact-sha256.json', Object.fromEntries(files.map(file => [file, sha(readFileSync(resolve(output, file)))])));
renameSync(output, destination);
console.log(JSON.stringify({output: destination, unitCases: 10, selectedNativeCases: selected.length, physicalDateChoiceAccepted: false}));
} finally {rmSync(output, {recursive: true, force: true});}

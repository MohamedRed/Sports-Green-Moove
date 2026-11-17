import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const privateRoot = '/Users/mrr/.codex/sgm-native-comparison-20261031';
const destination = resolve(root, 'docs/release/evidence/transfer-lifecycle-2026-10-31');
assert(!existsSync(destination), 'Retained attempts are immutable');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const api = path => JSON.parse(execFileSync('/opt/homebrew/bin/gh', ['api', 'repos/MohamedRed/Sports-Green-Moove/' + path],
  {encoding: 'utf8', maxBuffer: 4_000_000}));
const mainRun = api('actions/runs/41199832039'), mainJobs = api('actions/runs/41199832039/jobs?per_page=100');
assert.equal(mainRun.status, 'completed'); assert.equal(mainRun.conclusion, 'failure');
assert.equal(mainRun.head_sha, '5fa6fc49f73d3b1f4523ee77bd8c818a4d5368dc');
assert.equal(mainJobs.jobs.find(row => row.id === 124533274682).conclusion, 'success');
assert.equal(mainJobs.jobs.find(row => row.id === 124533274943).conclusion, 'failure');
const output = mkdtempSync(resolve(dirname(destination), '.transfer-lifecycle-stage-'));
try {
  for (const directory of ['before-probe', 'candidate-probe', 'native-main', 'native-main/replay']) mkdirSync(resolve(output, directory), {recursive: true});
  const files = [], save = (path, bytes) => {writeFileSync(resolve(output, path), bytes, {flag: 'wx'}); files.push(path);};
  const record = (path, value) => save(path, JSON.stringify(value, null, 2) + '\n');
  const copy = (from, to) => save(to, readFileSync(from));
  const archive = (path, commit) => {
    const bytes = execFileSync('git', ['show', commit + ':' + path], {cwd: root}), digest = sha(bytes);
    const target = resolve(root, 'docs/release/evidence/source-archive', digest + '.txt');
    if (existsSync(target)) assert.deepEqual(readFileSync(target), bytes); else writeFileSync(target, bytes, {flag: 'wx'});
    return [path, digest];
  };
  const sourcePaths = ['scripts/diagnostics/adb-transfer-probe.mjs', 'scripts/diagnostics/adb-transfer-outcome.mjs',
    'scripts/diagnostics/run-adb-transfer-probe.mjs', 'scripts/qa/adb-host-health.mjs', 'scripts/qa/adb-host-sockets.mjs',
    'scripts/qa/emulator-host-observation.mjs'];
  for (const [folder, runId, artifactId, expectedHead] of [
    ['before-probe', 41199832059, 13042610438, mainRun.head_sha],
    ['candidate-probe', 41202387017, 13042779053, '51c183e7af60a79c3096d55e65eb0b33ce1b0d26'],
  ]) {
    const run = api('actions/runs/' + runId), jobs = api('actions/runs/' + runId + '/jobs?per_page=100');
    assert.equal(run.status, 'completed'); assert.equal(run.head_sha, expectedHead);
    const origin = resolve(privateRoot, 'transfer-lifecycle-originals', String(artifactId));
    const artifact = JSON.parse(readFileSync(resolve(origin, 'artifact.json'))), zip = readFileSync(resolve(origin, 'original.zip'));
    assert.equal(artifact.workflow_run.id, runId); assert.equal(artifact.workflow_run.head_sha, expectedHead);
    assert.equal(zip.length, artifact.size_in_bytes); assert.equal('sha256:' + sha(zip), artifact.digest);
    const members = execFileSync('/usr/bin/unzip', ['-Z1', resolve(origin, 'original.zip')], {encoding: 'utf8'}).trim().split('\n');
    assert(members.every(file => /^(environment|result|started|trial-\d{2})\.json$/.test(file)));
    const memberHashes = {};
    for (const file of members) {
      const bytes = execFileSync('/usr/bin/unzip', ['-p', resolve(origin, 'original.zip'), file]);
      assert.deepEqual(bytes, readFileSync(resolve(origin, file))); save(folder + '/' + file, bytes); memberHashes[file] = sha(bytes);
    }
    copy(resolve(origin, 'original.zip'), folder + '/original.zip'); record(folder + '/artifact.json', artifact);
    record(folder + '/run.json', run); record(folder + '/jobs.json', jobs); record(folder + '/member-sha256.json', memberHashes);
    record(folder + '/source-sha256.json', Object.fromEntries([...sourcePaths,
      ...(folder === 'candidate-probe' ? ['scripts/diagnostics/adb-transfer-emulator.mjs'] : [])].map(path => archive(path, expectedHead))));
  }
  const native = resolve(privateRoot, 'native-5fa6fc4/outputs');
  const replay = 'local-ui-evidence/e35ae282489da449e7a602ca35c1ceec';
  for (const [from, to] of Object.entries({
    'ordinary-instrumentation.txt': 'ordinary-instrumentation.txt', 'ordinary-results.json': 'ordinary-results.json',
    'ordinary-process.json': 'ordinary-process.json', 'native-suite-status.json': 'native-suite-status.json',
    'disposable-device-setup.json': 'device-setup.json', 'disposable-store-restore.json': 'device-restore.json',
  })) copy(resolve(native, 'store-review-screenshots', from), 'native-main/' + to);
  for (const file of readdirSync(resolve(native, replay)).filter(file => file.endsWith('-instrumentation.txt') ||
    file.startsWith('adb-pull-') || ['results.json', 'local-chat-network-ui.json'].includes(file)))
    copy(resolve(native, replay, file), 'native-main/replay/' + file);
  record('native-main/run.json', mainRun); record('native-main/jobs.json', mainJobs);
  record('native-main/artifact.json', api('actions/artifacts/13042653847'));
  const log = execFileSync('/opt/homebrew/bin/gh', ['api', 'repos/MohamedRed/Sports-Green-Moove/actions/jobs/124533274943/logs'], {maxBuffer: 2_000_000});
  assert.match(log.toString(), /##\[error\]Timeout waiting for emulator to boot\./);
  record('native-main/failed-boot-log.json', {jobId: 124533274943, sourceHead: mainRun.head_sha,
    scope: 'fixed-classification-of-terminal-job-log-not-device-state-or-app-failure-proof',
    message: 'Timeout waiting for emulator to boot.', originalLogSha256: sha(log), originalLogBytes: log.length,
    originalLogRetainedPrivately: false, rawLogPublished: false, applicationCaseReached: false, rootCauseConfirmed: false});
  record('native-main/source-sha256.json', Object.fromEntries(['scripts/qa/local-android-session.mjs',
    'scripts/qa/local-chat-network-ui.mjs', 'scripts/qa/local-network-replay.mjs',
    'android/app/src/androidTest/java/be/sportgreenmoove/app/ui/LocalChatNetworkFlowTest.kt'].map(path => archive(path, mainRun.head_sha))));
  record('review.json', {scope: 'native-main-pass-with-failed-separate-boot-and-intermittent-transfer-not-release', reviewedAt: '2026-10-31',
    beforeTransferPasses: 24, beforeTransferFailures: 1, candidateTransferPasses: 32,
    mainReplayGroups: 37, mainReplayNativeCases: 40, mainPrimaryCopies: 17,
    newLinuxHostObservationAvailable: true, candidateFailureReproduced: false, realFailureLifecycleDistinguished: false,
    nativeMainArchiveDigestVerified: false, probeArchiveDigestsVerified: true,
    underlyingCauseConfirmed: false, earlierCopyFailureRepaired: false, passAttributedToObservation: false,
    retryAdded: false, deadlinesChanged: false, productCodeChanged: false, fullNativeGateAccepted: false,
    physicalDeviceAccepted: false, productionWrites: false, releaseAccepted: false, publishedMedia: []});
  record('artifact-sha256.json', Object.fromEntries(files.map(path => [path, sha(readFileSync(resolve(output, path)))])));
  renameSync(output, destination); console.log(JSON.stringify({retained: destination, candidatePasses: 32, fullNativeGateAccepted: false}));
} finally {rmSync(output, {recursive: true, force: true});}

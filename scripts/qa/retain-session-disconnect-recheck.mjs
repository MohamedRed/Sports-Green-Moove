import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {sessionDisconnectTranscripts} from './session-disconnect-retained-evidence.mjs';
import {sessionDisconnectCaptures} from './session-disconnect-evidence.mjs';

const root = resolve(import.meta.dirname, '../..'), privateRoot = '/Users/mrr/.codex/sgm-native-comparison-20261031';
const destination = resolve(root, 'docs/release/evidence/session-disconnect-recheck-2026-10-31');
assert(!existsSync(destination), 'Retained attempts cannot be overwritten');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const api = path => execFileSync('/opt/homebrew/bin/gh', ['api', 'repos/MohamedRed/Sports-Green-Moove/' + path], {maxBuffer: 8_000_000});
const output = mkdtempSync(resolve(dirname(destination), '.disconnect-stage-')), files = [];
const save = (path, bytes) => {writeFileSync(resolve(output, path), bytes, {flag: 'wx'}); files.push(path);};
const record = (path, value) => save(path, JSON.stringify(value, null, 2) + '\n');
try {
  for (const [name, id, jobId, head, runId, prefix, local, passed] of [
    ['failed', 13043247915, 124540585301, '51c183e7af60a79c3096d55e65eb0b33ce1b0d26', 41202387345,
      'db3c14fbbcd8ce43297b1662dfcb14be', 'session-disconnect-51c183e', false],
    ['passed', 13043354303, 124543847357, 'c76c3cec419314838db1056bf27842a0750ada67', 41203498719,
      '0814f84568315ad652b1d4f66e26b33f', 'session-disconnect-c76c3ce', true],
  ]) {
    mkdirSync(resolve(output, name));
    const artifact = JSON.parse(api('actions/artifacts/' + id)), job = JSON.parse(api('actions/jobs/' + jobId));
    assert.equal(artifact.workflow_run.head_sha, head); assert.equal(artifact.workflow_run.id, runId);
    assert.equal(job.run_id, runId); assert.equal(job.status, 'completed'); assert.equal(job.conclusion, passed ? 'success' : 'failure');
    const original = api('actions/artifacts/' + id + '/zip');
    assert.equal(original.length, artifact.size_in_bytes); assert.equal('sha256:' + sha(original), artifact.digest);
    const zip = resolve(privateRoot, local, 'original-provider-artifact.zip');
    if (existsSync(zip)) assert.deepEqual(readFileSync(zip), original); else writeFileSync(zip, original, {mode: 0o600, flag: 'wx'});
    const selected = {};
    for (const file of passed ? [...sessionDisconnectTranscripts, ...sessionDisconnectCaptures,
      'session-disconnect-results.json', 'session-disconnect-app-results.json', 'local-session-disconnect-device.json',
      'local-session-disconnect-before.json', 'local-session-disconnect-stop.json', 'session-disconnect-proxy.json',
      'adb-pull-session-disconnect.json'] : [sessionDisconnectTranscripts[0], 'session-disconnect-proxy-failed.json'])
      selected[file] = 'local-ui-evidence/' + prefix + '/' + file;
    for (const file of ['disposable-device-setup.json', 'disposable-device-setup.json.claimed',
      'disposable-device-restore.json', 'session-disconnect-suite-status.json']) selected[file] = 'focused-safety-ui/session-disconnect/' + file;
    const hashes = {};
    for (const [file, member] of Object.entries(selected)) {
      const bytes = execFileSync('/usr/bin/unzip', ['-p', zip, member]);
      assert.deepEqual(bytes, readFileSync(resolve(privateRoot, local, member)));
      save(name + '/' + file, bytes); hashes[member] = sha(bytes);
    }
    record(name + '/artifact.json', artifact); record(name + '/job.json', job);
    record(name + '/archive-verification.json', {providerDigestVerified: true, originalArchivePublished: false,
      sizeBytes: original.length, digest: artifact.digest, selectedMemberSha256: hashes});
  }
  const report = JSON.parse(readFileSync(resolve(output, 'passed/session-disconnect-results.json'))), failedSources = {};
  for (const [path, expected] of Object.entries(report.sourceFiles)) {
    for (const head of ['51c183e7af60a79c3096d55e65eb0b33ce1b0d26', 'c76c3cec419314838db1056bf27842a0750ada67']) {
      const bytes = execFileSync('git', ['show', head + ':' + path], {cwd: root}), digest = sha(bytes); assert.equal(digest, expected);
      const archive = resolve(root, 'docs/release/evidence/source-archive', digest + '.txt');
      if (existsSync(archive)) assert.deepEqual(readFileSync(archive), bytes); else writeFileSync(archive, bytes, {flag: 'wx'});
    }
    failedSources[path] = expected;
  }
  record('failed/source-sha256.json', failedSources);
  record('review.json', {scope: 'failed-initial-auth-and-passing-two-process-disconnect-not-instability-repair', checkedAt: '2026-10-31',
    sameBoundSourceFiles: true, originalArchiveDigestsVerified: true, failedInitialAuthAttempts: 1, passedNativeCases: 2,
    localDisconnectReplayAccepted: true, priorAuthFailureFixed: false, rootCauseConfirmed: false,
    newDiagnosticsExercised: false, fullNativeGateAccepted: false, physicalDeviceAccepted: false,
    realNetworkLossVerified: false, productionWrites: false, releaseAccepted: false, publishedMedia: []});
  record('artifact-sha256.json', Object.fromEntries(files.map(file => [file, sha(readFileSync(resolve(output, file)))])));
  renameSync(output, destination); console.log(JSON.stringify({retained: destination, localNativeCases: 2, releaseAccepted: false}));
} finally {rmSync(output, {recursive: true, force: true});}

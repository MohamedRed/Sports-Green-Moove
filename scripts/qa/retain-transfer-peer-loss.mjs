import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {existsSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';

const root = resolve(import.meta.dirname, '../..'), destination = resolve(root, 'docs/release/evidence/transfer-peer-loss-2026-10-31');
assert(!existsSync(destination), 'Retained failed primary transfers are immutable');
const original = '/Users/mrr/.codex/sgm-native-comparison-20261031/transport-1683526';
const zip = resolve(original, 'original-provider-artifact.zip'), sha = bytes => createHash('sha256').update(bytes).digest('hex');
const api = path => JSON.parse(execFileSync('/opt/homebrew/bin/gh', ['api', 'repos/MohamedRed/Sports-Green-Moove/' + path], {maxBuffer: 4_000_000}));
const artifact = api('actions/artifacts/13044905885'), run = api('actions/runs/41206766250'), job = api('actions/jobs/124553316302');
assert.equal(run.head_sha, '16835261a8b9cb02420f9be107e9cd98337564b5');
assert.equal(run.status, 'completed'); assert.equal(run.conclusion, 'failure'); assert.equal(job.conclusion, 'failure');
const archive = readFileSync(zip); assert.equal(archive.length, artifact.size_in_bytes); assert.equal('sha256:' + sha(archive), artifact.digest);
const members = execFileSync('/usr/bin/unzip', ['-Z1', zip], {encoding: 'utf8'}).trim().split('\n');
assert.equal(members.length, 32); assert(members.every(file => /^(environment|result|started|trial-\d{2})\.json$/.test(file)));
const stage = mkdtempSync(resolve(dirname(destination), '.peer-loss-stage-')), files = [];
const save = (file, bytes) => {writeFileSync(resolve(stage, file), bytes, {flag: 'wx'}); files.push(file);};
const record = (file, value) => save(file, JSON.stringify(value, null, 2) + '\n');
try {
  const hashes = {};
  for (const file of members) {
    const bytes = execFileSync('/usr/bin/unzip', ['-p', zip, file]);
    assert.deepEqual(bytes, readFileSync(resolve(original, 'android-generated-transfer-diagnostic', file)));
    save(file, bytes); hashes[file] = sha(bytes);
  }
  save('original.zip', archive); record('member-sha256.json', hashes);
  record('artifact.json', artifact); record('run.json', run); record('job.json', job);
  const sources = {};
  for (const path of ['scripts/diagnostics/adb-transfer-probe.mjs', 'scripts/diagnostics/adb-transfer-outcome.mjs',
    'scripts/diagnostics/run-adb-transfer-probe.mjs', 'scripts/diagnostics/adb-transfer-emulator.mjs',
    'scripts/qa/adb-host-health.mjs', 'scripts/qa/adb-host-sockets.mjs', 'scripts/qa/adb-daemon-events.mjs', 'scripts/qa/emulator-host-observation.mjs']) {
    const bytes = execFileSync('git', ['show', run.head_sha + ':' + path], {cwd: root}), hash = sha(bytes);
    const target = resolve(root, 'docs/release/evidence/source-archive', hash + '.txt');
    if (existsSync(target)) assert.deepEqual(readFileSync(target), bytes); else writeFileSync(target, bytes, {flag: 'wx'});
    sources[path] = hash;
  }
  record('source-sha256.json', sources);
  record('review.json', {scope: 'surviving-host-emulator-and-adb-server-with-peer-loss-not-guest-state-or-repair', reviewedAt: '2026-10-31',
    passedPrimaryTransfers: 28, failedPrimaryAttempt: 29, unexecutedPlannedTransfers: 3,
    originalArchiveDigestVerified: true, hostEmulatorObservedPresentAfterFailure: true, sameEmulatorBirth: true,
    sameHostAdbServerBirthAndListener: true, priorEmulatorPeerSocketAbsentAfterFailure: true,
    guestBootStateKnown: false, guestAdbdStateKnown: false, hostProcessContinuityFullyObserved: false,
    newParentAndStateFieldsExercised: false, remoteCleanupVerified: false, runnerDisposalIndependentlyVerified: false,
    rootCauseConfirmed: false, earlierCopyFailureRepaired: false, productCodeChanged: false, retryAdded: false,
    deadlinesChanged: false, fullNativeGateAccepted: false, physicalDeviceAccepted: false, productionWrites: false,
    releaseAccepted: false, publishedMedia: []});
  record('artifact-sha256.json', Object.fromEntries(files.map(file => [file, sha(readFileSync(resolve(stage, file)))])));
  renameSync(stage, destination); console.log(JSON.stringify({retained: destination, passedTransfers: 28, rootCauseConfirmed: false}));
} finally {rmSync(stage, {recursive: true, force: true});}

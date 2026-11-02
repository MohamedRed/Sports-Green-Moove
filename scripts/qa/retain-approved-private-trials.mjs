import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {assertLocalEndpointsClosed} from './local-emulator-lifecycle.mjs';
import {cropPrivateTrialCapture, privateTrialCaptures} from './private-trial-captures.mjs';

const root = resolve(import.meta.dirname, '../..');
const folder = resolve(root, 'docs/release/evidence/approved-private-trials-2026-11-02');
assert(!existsSync(folder));
const input = '/Users/mrr/.codex/tmp/sgm-invitation-same-origin-phone.OxqmQb';
const preflight = '/Users/mrr/.codex/tmp/sgm-invitation-same-origin-preflight-final.zQob6z/observations';
for (const path of [input + '/phone-session.json', input + '/phone-session.json.signup', input + '/phone-code-private.png',
  '/var/folders/b4/qz25f4f94vx9h0tv1d4xs3k80000gn/T/sgm-scoped-bs-iNms9z']) assert(!existsSync(path));
const endpoints = await assertLocalEndpointsClosed([9099, 8080, 9000, 5001, 4185, 49903, 51404]);
for (const path of ['phone/originals', 'phone/captures', 'phone/account-observations', 'preflight', 'network'])
  mkdirSync(resolve(folder, path), {recursive: true});
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const write = (file, value) => writeFileSync(resolve(folder, file), Buffer.isBuffer(value) ? value : JSON.stringify(value, null, 2) + '\n', {flag: 'wx'});
const copy = (from, to) => copyFileSync(from, resolve(folder, to), 1);
for (const file of ['observations.json', 'disposal.json']) copy(input + '/observations/' + file, 'phone/' + file);
for (const file of ['baseline.json', 'child-signed-in.json', 'session-results.json'])
  copy(input + '/account-observations/' + file, 'phone/account-observations/' + file);
for (const file of ['observations.json', 'same-origin-browser-check.json', 'disposal.json']) copy(preflight + '/' + file, 'preflight/' + file);
copy(input + '/uninstall-observation.txt', 'phone/uninstall-observation.txt');
for (const id of privateTrialCaptures) {
  const bytes = readFileSync(input + '/phone-' + id + '-session.png');
  write('phone/originals/' + id + '.jpg', bytes); write('phone/captures/' + id + '.png', cropPrivateTrialCapture(bytes, id));
}
const zipPath = '/Users/mrr/.codex/tmp/sgm-approved-startup-logging-20261102.zip', zip = readFileSync(zipPath);
assert.equal(zip.length, 7542); assert.equal(sha(zip), '3b6de46508d37ed4756b4c5aba68a437507e01797cbfa22c3e4af82d3b639c29');
write('network/original-artifact.zip', zip);
const members = ['started.json', 'restoration.json'];
for (let i = 0; i < 3; i++) members.push(`sample-${i}.json`, ...['carrier', 'default-selection', 'modem', 'subscriptions']
  .map(kind => `sample-${i}/chat-${kind}-before.json`));
for (const member of members) {
  mkdirSync(resolve(folder, 'network', member, '..'), {recursive: true});
  write('network/' + member, execFileSync('/usr/bin/unzip', ['-p', zipPath, member], {maxBuffer: 128 * 1024}));
}
write('network/provenance.json', {sourceCommit: 'b46e0481109f37ff3e88119fd44763dca33e1c04', runId: 41502854405,
  jobId: 125474514539, conclusion: 'failure', artifactId: 13169511923, artifactBytes: zip.length, artifactSha256: sha(zip),
  hostTerminationAcknowledged: true, propertyRestorationVerified: false, failedReceiptUnmodified: true});
const observations = JSON.parse(readFileSync(resolve(folder, 'phone/observations.json')));
const account = JSON.parse(readFileSync(resolve(folder, 'phone/account-observations/session-results.json')));
write('phone/approval-observer-failure.json', {scope: 'original-invited-child-observer-schema-rejection-not-parent-approval',
  sourceCommit: 'fccd8ef', failedPhase: 'code-created', completed: false, passedPhases: account.checkpoints.map(row => row.phase),
  rejectedUnexpectedField: 'invitationHash', parentApproved: false, originalReportUnmodified: true});
const sources = {};
function archive(paths, commit) {
  const hashes = {};
  for (const file of paths) {
    const bytes = execFileSync('/usr/bin/git', ['show', commit + ':' + file], {cwd: root, maxBuffer: 2 * 1024 * 1024});
    const hash = sha(bytes); hashes[file] = hash;
    const target = resolve(root, 'docs/release/evidence/source-archive', hash + '.txt');
    if (existsSync(target)) assert(readFileSync(target).equals(bytes)); else writeFileSync(target, bytes, {flag: 'wx'});
  }
  return hashes;
}
for (const [file, expected] of Object.entries({...observations.sourceFiles, ...account.sourceFiles})) {
  const hashes = archive([file], 'fccd8ef'); assert.equal(hashes[file], expected); sources[file] = expected;
}
write('phone/source-files.json', sources);
write('network/source-files.json', archive(['.github/workflows/android-transport-probe.yml', '.github/workflows/network-startup-logging.yml',
  'scripts/qa/network-startup-logging.mjs', 'scripts/qa/run-network-startup-logging.mjs', 'scripts/qa/disposable-android-shell.mjs',
  ...['modem', 'subscription', 'default-selection', 'carrier'].map(kind => `scripts/qa/local-${kind}-diagnostics.mjs`)], 'b46e048'));
write('phone/disposal-review.json', {sessionStopped: true, uninstallAcknowledged: true, independentPackageAbsenceProven: false,
  helperExitCode: 130, helperDirectoryAbsent: true, helperGroupExitVerified: true, privateInputsAbsent: true,
  endpoints, hostClipboardRestored: true, privatePasswordCleared: true, hostPermissionsChanged: false, devicePolicyChanged: false});
write('review.json', {scope: 'approved-private-child-signup-and-incomplete-simulated-network-diagnostic',
  testedAt: '2026-11-02', sourceCommit: observations.applicationHead, projectId: observations.projectId, runId: observations.runId,
  physicalPhoneObserved: true, phoneModel: 'Google Pixel 9 Pro', osVersion: '15.0',
  selectedApkSha256: '507c3fa6bb2e9bdc6139162b2cd4d6dd2de1770f876b0dfce7395a8c9c9b8c17',
  installedApkIndependentlyHashed: false, browserFormReached: true, mismatchRefused: true, childAccountCreated: true,
  nativeChildSignInObserved: true, accountCreatedCount: 1, redemptionCount: 1, parentApprovalProven: false,
  nativeShareToSignupProven: false, publicSignupDeployed: false, rootCauseConfirmed: false, networkDiagnosticPassed: false,
  networkPropertyRestored: false, productionWrites: false, realPayments: false, mapRequests: 0, requestLoggingEnabled: false,
  resolveAllUrlsEnabled: false, videoRecorded: false, publicCapturesAdded: 3, publicCropsReviewed: false, releaseComplete: false});
const hashes = Object.fromEntries(readdirSync(folder, {recursive: true, withFileTypes: true}).filter(row => row.isFile())
  .map(row => {const path = resolve(row.parentPath, row.name); return [path.slice(folder.length + 1), sha(readFileSync(path))];}));
write('artifact-sha256.json', hashes);
console.log('Retained one created child account, incomplete approval and the original failed network receipt; review crops next.');

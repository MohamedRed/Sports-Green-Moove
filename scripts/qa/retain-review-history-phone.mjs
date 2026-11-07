import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {cpSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync} from 'node:fs';
import {isAbsolute, resolve} from 'node:path';
import {tmpdir} from 'node:os';
import net from 'node:net';
import {reviewPhoneDirectory, validateReviewPhoneEvidence} from './review-history-phone-evidence.mjs';
import {reviewPhonePhases} from './review-history-phone-checkpoints.mjs';

const [trial, helperDirectory, helperPid] = process.argv.slice(2), root = resolve(import.meta.dirname, '../..');
assert(isAbsolute(trial ?? '') && isAbsolute(helperDirectory ?? '') && /^\d+$/.test(helperPid ?? ''));
assert(!existsSync(resolve(trial, 'private/session.json')) && !existsSync(helperDirectory));
assert(!readdirSync(tmpdir()).some(name => name.startsWith('sgm-local-runtime-')));
const processCheck = spawnSync('/bin/ps', ['-p', helperPid, '-o', 'pid='], {encoding: 'utf8'});
assert.equal(processCheck.status, 1); assert.equal(processCheck.stdout.trim(), '');
const ports = [];
for (const port of [5001, 8080, 9000, 9099, 45690, 45691]) {
  await new Promise((yes, no) => {
    const server = net.createServer(); server.once('error', no);
    server.listen(port, '127.0.0.1', () => server.close(error => error ? no(error) : yes()));
  }); ports.push({port, available: true});
}
const base = resolve(root, reviewPhoneDirectory); assert(!existsSync(base), 'Never overwrite original phone evidence');
const session = JSON.parse(readFileSync(resolve(trial, 'records/session-results.json'))); assert.equal(session.completed, true);
const review = JSON.parse(readFileSync(resolve(trial, 'ui-review.json')));
mkdirSync(base, {recursive: true});
cpSync(resolve(trial, 'records'), resolve(base, 'records'), {recursive: true});
cpSync(resolve(trial, 'captures'), resolve(base, 'captures'), {recursive: true});
const save = (file, value) => writeFileSync(resolve(base, file), JSON.stringify(value, null, 2) + '\n', {flag: 'wx'});
save('ui-review.json', review);
save('summary.json', {scope: 'physical-android-review-history-not-release-proof', projectId: session.projectId, runId: session.runId,
  testedAt: session.testedAt, sourceBaselineCommit: '0c5fa32c1bad24d4073d34d89dc2c4f676a46113',
  apkSourceBaselineCommit: 'ce93e568b7f636c0d6ce39f91daec4c4b80d72e7',
  sourceApkSha256: '2b881a93effb05578b748fcc50f3f5299552f985b83fc953dd729cfdd1e67fc0',
  installedBytesIndependentlyVerified: false, device: 'Google Pixel 9 Pro / Android 15', physicalDeviceCount: 1,
  publicCaptureMethod: 'browser-session-window-not-native-export', publicCaptures: reviewPhonePhases, completedCheckpoints: 7,
  processRestartProven: false, rideCompletionUiProven: false, receivedRatingsProven: false, longerRideDiscoveryProven: false,
  productionWrites: false, productionDeployed: false, releaseComplete: false, videoAccepted: false,
  providerMapRequests: 0, realPaymentExercised: false});
save('disposal.json', {observedAt: new Date().toISOString(), observerExitCode: 0, runtimeExitCode: 130, helperExitCode: 130,
  privateSessionAbsent: true, helperDirectoryAbsent: true, helperProcessAbsent: true, noLocalRuntimeDirectories: true, ports,
  stopMethod: 'SIGINT-supervised-launchers-with-verified-group-exit-then-independent-path-pid-port-checks'});
const archive = resolve(root, 'docs/release/evidence/source-archive'); mkdirSync(archive, {recursive: true});
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
for (const [file, expected] of Object.entries(session.sourceFiles)) {
  const bytes = readFileSync(resolve(root, file)); assert.equal(hash(bytes), expected);
  const destination = resolve(archive, expected + '.txt');
  if (!existsSync(destination)) writeFileSync(destination, bytes, {flag: 'wx'});
}
const hashes = {}, walk = directory => {for (const entry of readdirSync(resolve(base, directory), {withFileTypes: true})) {
  const file = directory ? directory + '/' + entry.name : entry.name;
  if (entry.isDirectory()) walk(file); else hashes[file] = hash(readFileSync(resolve(base, file)));
}}; walk(''); save('artifact-sha256.json', hashes);
console.log(JSON.stringify(validateReviewPhoneEvidence(root)));

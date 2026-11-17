import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync} from 'node:fs';
import {isAbsolute, resolve} from 'node:path';

const root = resolve(import.meta.dirname, '../..'), source = '1030dacade440644028cdd2de072c45718b9d7a4';
const [main, focused] = process.argv.slice(2); assert([main, focused].every(path => path && isAbsolute(path)));
const folder = resolve(root, 'docs/release/evidence/native-checks-1030dac-2026-11-02'); assert(!existsSync(folder));
const gh = args => JSON.parse(execFileSync('/opt/homebrew/bin/gh', args, {encoding: 'utf8'}));
const checks = gh(['pr', 'view', '1', '--repo', 'MohamedRed/Sports-Green-Moove', '--json', 'headRefOid,statusCheckRollup']);
assert.equal(checks.headRefOid, source); assert(checks.statusCheckRollup.every(row => row.status === 'COMPLETED'));
mkdirSync(folder);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const write = (file, value) => {
  const path = resolve(folder, file); mkdirSync(resolve(path, '..'), {recursive: true});
  writeFileSync(path, Buffer.isBuffer(value) ? value : JSON.stringify(value, null, 2) + '\n', {flag: 'wx'});
};
const members = {}, artifacts = gh(['api', 'repos/MohamedRed/Sports-Green-Moove/actions/runs/41519576523/artifacts']).artifacts;
const retain = (input, artifactName, member, file) => {
  const artifact = artifacts.find(row => row.name === artifactName); assert(artifact);
  const bytes = readFileSync(resolve(input, member)); write(file, bytes);
  members[file] = {artifactId: artifact.id, member, sha256: sha(bytes)};
};
const mainArtifact = 'android-connected-ui-test-results', mainSession = 'outputs/local-ui-evidence/d0428e49399d1ad91f5ec36aede3a3b1/';
for (const [member, file] of [
  ['outputs/store-review-screenshots/ordinary-results.json', 'ordinary-results.json'],
  ['outputs/store-review-screenshots/ordinary-instrumentation.txt', 'ordinary-instrumentation.txt'],
  ['outputs/store-review-screenshots/native-suite-status.json', 'suite-status.json'],
  ['outputs/store-review-screenshots/disposable-store-restore.json', 'restoration.json'],
  ['outputs/focused-safety-ui/full-matrix/host-shutdown/complete.json', 'host-exit.json'],
  ...['adb-pull-trip-change-inputs.json', 'adb-sync-trip-change-inputs-diagnostics.json', 'adb-pull-failure-cleanup.json',
    'LocalTripChangeInputsFlowTest-instrumentation.txt'].map(name => [mainSession + name, name]),
]) retain(main, mainArtifact, member, 'main/' + file);
for (const directory of readdirSync(focused).sort()) {
  const phase = directory.replace('android-focused-safety-ui-', ''), input = resolve(focused, directory);
  const prefix = 'focused-safety-ui/' + phase + '/';
  for (const [member, file] of [[phase + '-suite-status.json', 'status.json'],
    ['disposable-device-restore.json', 'restoration.json'], ['host-shutdown/complete.json', 'host-exit.json']])
    retain(input, directory, prefix + member, 'focused/' + phase + '/' + file);
  const files = readdirSync(input, {recursive: true, withFileTypes: true}).filter(row => row.isFile());
  for (const entry of files) {
    const path = resolve(entry.parentPath, entry.name), member = path.slice(input.length + 1);
    if (entry.name.startsWith('adb-pull-') && entry.name.endsWith('.json'))
      retain(input, directory, member, 'focused/' + phase + '/' + entry.name);
    if (phase === 'native-startup' && ['LocalNativeTrackingStartupTest-instrumentation.txt',
      'local-native-startup-failure-tree.txt'].includes(entry.name))
      retain(input, directory, member, 'focused/' + phase + '/' + entry.name);
  }
}
const imageJob = gh(['api', 'repos/MohamedRed/Sports-Green-Moove/actions/jobs/125531815667']);
write('image-job.json', imageJob);
const log = execFileSync('/opt/homebrew/bin/gh', ['api', 'repos/MohamedRed/Sports-Green-Moove/actions/jobs/125531815667/logs'], {encoding: 'utf8'});
const lines = log.split('\n'), start = lines.findIndex(line => line.includes('##[group]Run sdkmanager --install'));
const end = lines.findIndex((line, index) => index > start && line.includes('##[error]Process completed with exit code 1.'));
assert(start >= 0 && end > start); write('image-install-excerpt.txt', Buffer.from(lines.slice(start, end + 1).join('\n') + '\n'));
write('pr-checks.json', checks); write('artifact-inventory.json', artifacts); write('retained-members.json', members);
write('review.json', {scope: 'terminal-current-checks-with-primary-copy-and-preparation-failures-not-release-proof',
  checkedAt: '2026-11-02', sourceCommit: source, nativeRunId: 41519576523, nativeJobId: 125531814779,
  ordinaryPassed: 248, ordinarySkipped: 55, ordinaryFailed: 0, focusedPassed: 9, focusedFailed: 2,
  passedChecks: 20, failedChecks: 4, skippedChecks: 6, restoredDevices: 11, hostExitsObserved: 11,
  originalArchiveDigestIndependentlyVerified: false, selectedMemberDigestsRecorded: true,
  fullNativeGateAccepted: false, primaryCopyRepaired: false, signupParentApprovalAccepted: false,
  physicalDeviceAccepted: false, productionWrites: false, releaseComplete: false, publicCapturesAdded: 0,
  rootCauseConfirmed: false});
const files = readdirSync(folder, {recursive: true, withFileTypes: true}).filter(row => row.isFile());
write('artifact-sha256.json', Object.fromEntries(files.map(row => {
  const path = resolve(row.parentPath, row.name); return [path.slice(folder.length + 1), sha(readFileSync(path))];
})));
console.log('Retained terminal current-source failures and independently observed disposal, without new accepted flows.');

import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';

const root = resolve(import.meta.dirname, '../..'), source = '5d34c0f1fac1ba39571c4b420e0c4b81129de5d8';
const input = '/Users/mrr/.codex/tmp/sgm-child-parent-approval-phone.YnnqZS/team-read-ci.zip';
const folder = resolve(root, 'docs/release/evidence/focused-copy-5d34c0f-2026-11-02'); assert(!existsSync(folder));
const sha = bytes => createHash('sha256').update(bytes).digest('hex'), zip = readFileSync(input);
assert.equal(zip.length, 1643715); assert.equal(sha(zip), '5bedc554847249cbc8491c47fd5ee53519ad7603728ffa38919ad3def8f2ce7c');
mkdirSync(folder);
const write = (file, value) => writeFileSync(resolve(folder, file), Buffer.isBuffer(value) ? value : JSON.stringify(value, null, 2) + '\n', {flag: 'wx'});
const base = 'focused-safety-ui/team-read-components/', chat = 'local-ui-evidence/0585a01ede374c2ade285baafa36130b/';
const exit = 'local-ui-evidence/e0334404d047c294407d2b33db1b00f2/', alert = 'local-ui-evidence/559b1f8aa81cb2b3cc68232be0b90730/';
const members = {'suite-status.json': base + 'team-read-components-suite-status.json',
  'device-restoration.json': base + 'disposable-device-restore.json', 'host-exit.json': base + 'host-shutdown/complete.json',
  'read-components.json': chat + 'results.json', 'read-components.txt': chat + 'instrumentation.txt',
  'session-exit.json': exit + 'session-shutdown-results.json', 'session-exit.txt': exit + 'instrumentation.txt',
  'alert-opening.txt': alert + 'TeamPushOpenFlowTest.txt', 'alert-platform.txt': alert + 'TeamPushPlatformFlowTest.txt',
  'failed-primary-copy.json': alert + 'adb-pull-team-alert-opening.json',
  'sync-diagnostics.json': alert + 'adb-sync-team-alert-opening-diagnostics.json',
  'notification-restoration.json': alert + 'notification-permission-restoration.json'};
for (const [file, member] of Object.entries(members)) write(file, execFileSync('unzip', ['-p', input, member], {maxBuffer: 128 * 1024}));
const json = file => JSON.parse(readFileSync(resolve(folder, file)));
const paths = new Set([...Object.keys(json('read-components.json').sourceFiles), ...Object.keys(json('session-exit.json').sourceFiles),
  'tests/adb-transfer-emulator.test.mjs', 'scripts/diagnostics/adb-transfer-emulator.mjs',
  'android/app/src/androidTest/java/be/sportgreenmoove/app/ui/TeamPushOpenFlowTest.kt',
  'android/app/src/androidTest/java/be/sportgreenmoove/app/services/TeamPushPlatformFlowTest.kt']);
const sourceFiles = {};
for (const file of paths) {
  const bytes = execFileSync('git', ['show', source + ':' + file], {cwd: root}), hash = sha(bytes); sourceFiles[file] = hash;
  const target = resolve(root, 'docs/release/evidence/source-archive', hash + '.txt');
  if (existsSync(target)) assert(readFileSync(target).equals(bytes)); else writeFileSync(target, bytes, {flag: 'wx'});
}
write('source-files.json', sourceFiles);
const checks = JSON.parse(execFileSync('/opt/homebrew/bin/gh', ['pr', 'view', '1', '--repo', 'MohamedRed/Sports-Green-Moove',
  '--json', 'headRefOid,mergeStateStatus,statusCheckRollup'], {encoding: 'utf8'}));
assert.equal(checks.headRefOid, source); assert(checks.statusCheckRollup.every(row => row.status === 'COMPLETED'));
write('pr-checks.json', checks);
write('review.json', {scope: 'failed-focused-primary-capture-not-messaging-delivery-or-release-proof', sourceCommit: source,
  runId: 41513990057, jobId: 125512708927, artifactId: 13175670166, artifactSha256: sha(zip), artifactBytes: zip.length,
  componentReadCases: 3, sessionExitCases: 3, alertOpeningCases: 8, platformCases: 4, commandStatus: 1,
  primaryCopyPassed: false, hostAndGuestDisconnectObserved: true, exactDisconnectCauseProven: false,
  deviceRestorationVerified: true, hostExitObserved: true, notificationPermissionRestored: true,
  repairProven: false, fullNativeGateAccepted: false, physicalDeviceAccepted: false, pushDeliveryVerified: false,
  productionWrites: false, publicCapturesAdded: 0, releaseComplete: false});
const failed = readFileSync('/Users/mrr/.codex/tmp/sgm-parent-approval-input-stop-all-node-20261102.log', 'utf8');
const lines = failed.split('\n'), index = lines.findIndex(row => /^not ok .*exact process birth/.test(row)); assert(index >= 0);
write('separate-local-assertion-failure.txt', Buffer.from(lines.slice(index, index + 23).join('\n') + '\n'));
const observedLine = lines.find(row => row.includes('"monotonicMs":225.555708'));
assert(observedLine); const observed = JSON.parse(observedLine.slice(observedLine.indexOf('{'), observedLine.lastIndexOf('}') + 1));
assert.equal(observed.monotonicMs, 225.555708); assert.equal(observed.connections.length, 1);
assert.deepEqual(observed.connections.map(row => [row.localPort, row.remotePort]), [[5555, 48350]]);
assert.throws(() => assert.doesNotMatch(JSON.stringify(observed), /private|secret-token|0100000A|DO_NOT_READ|5557/));
write('assertion-reproduction.json', {scope: 'observed-local-clock-substring-collision-not-remote-copy-cause',
  oldPredicateRejected: true, collisionField: 'monotonicMs', observedMonotonicMs: observed.monotonicMs,
  observedPorts: observed.connections.map(row => [row.localPort, row.remotePort]),
  remoteFailureExplained: false, runtimeObserverChanged: false, physicalTrialExecuted: false});
write('artifact-sha256.json', Object.fromEntries(readdirSync(folder).map(file => [file, sha(readFileSync(resolve(folder, file)))])));
console.log('Retained the focused primary-copy failure and a separate deterministic local assertion reproduction.');

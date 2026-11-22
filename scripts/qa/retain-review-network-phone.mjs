import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {cpSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync} from 'node:fs';
import {isAbsolute, resolve} from 'node:path';
import {tmpdir} from 'node:os';
import net from 'node:net';
import {reviewNetworkPhoneFolder, reviewNetworkCaptureNames, validateReviewNetworkPhone} from './review-network-phone-evidence.mjs';
import {reviewNetworkPhases} from './review-network-phone-checkpoints.mjs';

const [trial, helperDirectory] = process.argv.slice(2), root = resolve(import.meta.dirname, '../..');
assert(isAbsolute(trial ?? '') && isAbsolute(helperDirectory ?? ''));
assert(!existsSync(resolve(trial, 'private/session.json')) && !existsSync(helperDirectory));
assert(!readdirSync(tmpdir()).some(name => name.startsWith('sgm-local-runtime-')));
for (const pid of [39749, 39756]) {
  const probe = spawnSync('/bin/ps', ['-p', String(pid), '-o', 'pid='], {encoding: 'utf8'});
  assert.equal(probe.status, 1); assert.equal(probe.stdout.trim(), '');
}
const closedPorts = [];
for (const port of [5001, 8080, 9000, 9099, 45690, 45691]) {
  await new Promise((yes, no) => {const server = net.createServer(); server.once('error', no);
    server.listen(port, '127.0.0.1', () => server.close(error => error ? no(error) : yes()));});
  closedPorts.push(port);
}
const review = JSON.parse(readFileSync(resolve(trial, 'ui-review.json')));
const phone = JSON.parse(readFileSync(resolve(trial, 'phone/session-results.json')));
assert.equal(phone.completed, true);
const base = resolve(root, reviewNetworkPhoneFolder); assert(!existsSync(base), 'Never overwrite evidence');
mkdirSync(resolve(base, 'records'), {recursive: true}); mkdirSync(resolve(base, 'captures'));
const copy = (source, destination) => cpSync(resolve(trial, source), resolve(base, destination));
for (const name of ['fixture', 'session-results', ...reviewNetworkPhases]) copy('phone/' + name + '.json', 'records/' + name + '.json');
for (const name of reviewNetworkCaptureNames) copy('phone/' + name + '-session.png', 'captures/' + name + '.jpg');
for (const name of ['force-stop-confirm', 'force-stop-disabled', 'signed-out'])
  copy('phone/' + name + '-session.png', 'captures/' + name + '.jpg');
copy('phone/offline-foreground-provider.txt', 'offline-provider.txt');
copy('phone/online-before-retry-provider.txt', 'online-provider.txt');
copy('phone/offline-resume-metadata-error-session.png', 'captures/preparation-offline-resume-error.jpg');
copy('initial-session-ended.json', 'initial-session-ended.json');
copy('phone/uninstall-inventory-mismatch.txt', 'uninstall-inventory-mismatch.txt');
copy('phone/uninstall-not-proven.txt', 'uninstall-not-proven.txt');
const save = (name, value) => writeFileSync(resolve(base, name + '.json'), JSON.stringify(value, null, 2) + '\n', {flag: 'wx'});
save('summary', {scope: 'physical-android-controlled-offline-review-retry-not-release',
  sourceCommit: 'b015934047595fab4925d066e331abf86659a778', testedAt: phone.testedAt, runId: phone.runId,
  sourceApkSha256: phone.sourceApkSha256, device: 'Google Pixel 9 Pro / Android 15', physicalDevices: 1,
  captureMethod: 'browser-session-window-not-native-export', recordCheckpoints: 8, ...review});
save('disposal', {observedAt: new Date().toISOString(), ownedRuntimeAbsent: true, privateSessionAbsent: true,
  ownedHelperAbsent: true, privateHandoffAbsent: true, closedPorts,
  ...Object.fromEntries(['hostClipboardRestored', 'remoteClipboardReplaced', 'providerIdleObserved']
    .map(key => {assert.equal(review[key], true); return [key, true];})),
  providerUninstallObserved: false, independentPackageAbsenceProven: false});
const archive = resolve(root, 'docs/release/evidence/source-archive'), hash = bytes => createHash('sha256').update(bytes).digest('hex');
for (const [file, expected] of Object.entries(phone.sourceFiles)) {
  const bytes = readFileSync(resolve(root, file)); assert.equal(hash(bytes), expected);
  const destination = resolve(archive, expected + '.txt'); if (!existsSync(destination)) writeFileSync(destination, bytes, {flag: 'wx'});
}
const hashes = {}, walk = directory => {for (const entry of readdirSync(resolve(base, directory), {withFileTypes: true})) {
  const file = directory ? directory + '/' + entry.name : entry.name;
  if (entry.isDirectory()) walk(file); else hashes[file] = hash(readFileSync(resolve(base, file)));
}}; walk(''); save('artifact-sha256', hashes);
console.log(JSON.stringify(validateReviewNetworkPhone(root)));

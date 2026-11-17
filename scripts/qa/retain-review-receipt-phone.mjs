import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {cpSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync} from 'node:fs';
import {isAbsolute, resolve} from 'node:path';
import {assertLocalEndpointsClosed} from './local-emulator-lifecycle.mjs';
import {reviewReceiptFolder, reviewReceiptPhases, reviewReceiptImages, validateReviewReceiptPhone} from './review-receipt-phone-evidence.mjs';

const [trial, failedTrial, helper] = process.argv.slice(2), root = resolve(import.meta.dirname, '../..');
assert([trial, failedTrial, helper].every(path => isAbsolute(path ?? '')));
await assertLocalEndpointsClosed([5001, 5002, 8080, 9000, 9099, 45690, 45691]);
for (const directory of [trial, failedTrial]) for (const name of ['runtime', 'session']) assert(!existsSync(resolve(directory, 'private/' + name + '.json')));
assert(!existsSync(helper));
const read = (folder, path) => JSON.parse(readFileSync(resolve(folder, path + '.json')));
const phone = read(trial, 'records/session-results'), review = read(trial, 'ui-review');
assert.equal(phone.completed, true);
const base = resolve(root, reviewReceiptFolder); assert(!existsSync(base), 'Never overwrite an original trial');
for (const folder of ['records', 'captures', 'original-session-captures', 'process', 'failed-attempt']) mkdirSync(resolve(base, folder), {recursive: true});
const copy = (folder, from, to = from) => cpSync(resolve(folder, from), resolve(base, to), {recursive: true, force: false, errorOnExist: true});
const save = (name, value) => writeFileSync(resolve(base, name + '.json'), JSON.stringify(value, null, 2) + '\n', {flag: 'wx'});
for (const name of ['fixture', 'session-results', ...reviewReceiptPhases]) copy(trial, 'records/' + name + '.json');
for (const name of ['parent-ready', ...reviewReceiptImages, 'signed-out']) {
  copy(trial, 'records/' + name + '-session.jpg', 'original-session-captures/' + name + '.jpg');
  if (reviewReceiptImages.includes(name)) execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error',
    '-i', resolve(trial, 'records/' + name + '-session.jpg'), '-vf', 'crop=375:833:516:112:exact=1',
    '-frames:v', '1', '-q:v', '2', '-pix_fmt', 'yuvj444p', resolve(base, 'captures/' + name + '.jpg')], {stdio: 'pipe'});
}
copy(trial, 'process', 'process');
copy(failedTrial, 'records/session-results.json', 'failed-attempt/session-results.json');
copy(failedTrial, 'records/driver-profile-error-session.jpg', 'failed-attempt/driver-profile-error-session.jpg');
save('summary', {scope: 'physical-android-controlled-post-commit-reply-loss-not-release',
  sourceCommit: 'b56c59f725d913f969cc8b1ec47427b177f9e54f', runId: phone.runId, sourceApkSha256: phone.sourceApkSha256,
  testedAt: phone.checks.at(-1).observedAt,
  device: 'Google Pixel 9 Pro / Android 15', physicalDevices: 1, recordCheckpoints: 7,
  captureMethod: 'cropped-browser-session-with-retained-original-not-native-export', ...review});
save('disposal', {observedAt: new Date().toISOString(), ownedPortsClosed: true, runtimeHandoffAbsent: true,
  appSessionAbsent: true, helperHandoffAbsent: true,
  ...Object.fromEntries(['hostClipboardRestored', 'remoteClipboardReplaced', 'providerIdleObserved'].map(key => {
    assert.equal(review[key], true); return [key, true];})), independentPackageAbsenceProven: false});
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
for (const [result, source] of [[phone, file => resolve(root, file)],
  [read(failedTrial, 'records/session-results'), file => resolve(failedTrial, 'original-source', file.split('/').at(-1))]]) {
  for (const [file, expected] of Object.entries(result.sourceFiles)) {
    const bytes = readFileSync(source(file)); assert.equal(hash(bytes), expected);
    const destination = resolve(root, 'docs/release/evidence/source-archive', expected + '.txt');
    if (!existsSync(destination)) writeFileSync(destination, bytes, {flag: 'wx'});
  }
}
const hashes = {}, walk = directory => {for (const entry of readdirSync(resolve(base, directory), {withFileTypes: true})) {
  const path = directory ? directory + '/' + entry.name : entry.name;
  if (entry.isDirectory()) walk(path); else hashes[path] = hash(readFileSync(resolve(base, path)));
}}; walk(''); save('artifact-sha256', hashes);
console.log(JSON.stringify(validateReviewReceiptPhone(root)));

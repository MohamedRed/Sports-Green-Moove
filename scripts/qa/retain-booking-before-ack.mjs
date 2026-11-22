import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {cpSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync} from 'node:fs';
import {isAbsolute, resolve} from 'node:path';
import {assertLocalEndpointsClosed} from './local-emulator-lifecycle.mjs';
import {bookingReceiptPlan} from './booking-receipt-checkpoint-plan.mjs';
import {bookingBeforeAckFolder, bookingBeforeAckImages, validateBookingBeforeAck} from './booking-before-ack-evidence.mjs';

const [trial, helper] = process.argv.slice(2), root = resolve(import.meta.dirname, '../..');
assert([trial, helper].every(path => isAbsolute(path ?? '')));
await assertLocalEndpointsClosed([5001, 5002, 8080, 9000, 9099, 45690, 45691]);
for (const name of ['runtime', 'session']) assert(!existsSync(resolve(trial, 'private/' + name + '.json')));
assert(!existsSync(helper));
const json = file => JSON.parse(readFileSync(resolve(trial, file + '.json')));
const phone = json('records/session-results'), review = json('ui-review'); assert.equal(phone.completed, true);
assert.equal(phone.sourceFilesUnchanged, true); assert.equal(phone.scenario, 'before-acknowledgement');
const base = resolve(root, bookingBeforeAckFolder); assert(!existsSync(base), 'Never overwrite an original trial');
for (const name of ['records', 'captures', 'original-session-captures', 'process']) mkdirSync(resolve(base, name), {recursive: true});
const copy = (from, to = from) => cpSync(resolve(trial, from), resolve(base, to), {recursive: true, force: false, errorOnExist: true});
const save = (file, value) => writeFileSync(resolve(base, file + '.json'), JSON.stringify(value, null, 2) + '\n', {flag: 'wx'});
for (const name of ['baseline', 'session-results', ...bookingReceiptPlan('before-acknowledgement').phases]) copy('records/' + name + '.json');
for (const name of readdirSync(resolve(trial, 'records')).filter(name => name.endsWith('-session.jpg')))
  copy('records/' + name, 'original-session-captures/' + name.replace(/-session\.jpg$/, '.jpg'));
for (const name of bookingBeforeAckImages) execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error',
  '-i', resolve(trial, 'records/' + name + '-session.jpg'), '-vf', 'crop=200:444:484:105:exact=1',
  '-frames:v', '1', '-q:v', '2', '-pix_fmt', 'yuvj444p', resolve(base, 'captures/' + name + '.jpg')], {stdio: 'pipe'});
copy('process');
save('system-ui-observations', Object.fromEntries([['before', 'app-info-before'], ['confirmation', 'force-stop-confirm'],
  ['stopped', 'force-stop-disabled'], ['reopened', 'reopened-home']].map(([key, name]) =>
  [key, statSync(resolve(trial, 'process/' + name + '-session.jpg')).mtime.toISOString()])));
save('summary', {scope: 'physical-android-controlled-adult-booking-restart-before-acknowledgement-not-release',
  appSourceBaseline: 'b015934047595fab4925d066e331abf86659a778', controllerBaseCommit: '471419812a0300e72f86d02a451c9d151af4ed7f',
  controllerSourcesBoundByHash: true, runId: phone.runId, sourceApkSha256: phone.sourceApkSha256,
  testedAt: phone.checks.at(-1).observedAt, recordCheckpoints: phone.checks.length,
  device: 'Google Pixel 9 Pro / Android 15', physicalDevices: 1,
  captureMethod: 'cropped-browser-session-with-retained-original-not-native-export', ...review});
save('disposal', {observedAt: new Date().toISOString(), ownedPortsClosed: true, runtimeHandoffAbsent: true,
  appSessionAbsent: true, helperHandoffAbsent: true});
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
for (const [file, expected] of Object.entries(phone.sourceFiles)) {
  const bytes = readFileSync(resolve(root, file)); assert.equal(hash(bytes), expected);
  const archive = resolve(root, 'docs/release/evidence/source-archive', expected + '.txt');
  if (!existsSync(archive)) writeFileSync(archive, bytes, {flag: 'wx'});
}
const hashes = {}, walk = directory => {for (const entry of readdirSync(resolve(base, directory), {withFileTypes: true})) {
  const file = directory ? directory + '/' + entry.name : entry.name;
  if (entry.isDirectory()) walk(file); else hashes[file] = hash(readFileSync(resolve(base, file)));
}}; walk(''); save('artifact-sha256', hashes);
console.log(JSON.stringify(validateBookingBeforeAck(root)));

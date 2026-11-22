import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {cpSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync} from 'node:fs';
import {isAbsolute, resolve} from 'node:path';
import {assertLocalEndpointsClosed} from './local-emulator-lifecycle.mjs';
import {bookingReceiptFolder, bookingReceiptImages, bookingReceiptPhases, validateBookingReceiptPhone} from './booking-receipt-phone-evidence.mjs';

const [trial, helper] = process.argv.slice(2), root = resolve(import.meta.dirname, '../..');
assert([trial, helper].every(path => isAbsolute(path ?? '')));
await assertLocalEndpointsClosed([5001, 5002, 8080, 9000, 9099, 45690, 45691]);
for (const name of ['runtime', 'session']) assert(!existsSync(resolve(trial, 'private/' + name + '.json')));
assert(!existsSync(helper));
const json = file => JSON.parse(readFileSync(resolve(trial, file + '.json')));
const phone = json('records/session-results'), review = json('ui-review'); assert.equal(phone.completed, true);
assert.equal(phone.sourceFilesUnchanged, true);
const base = resolve(root, bookingReceiptFolder); assert(!existsSync(base), 'Never overwrite an original trial');
for (const folder of ['records', 'captures', 'original-session-captures', 'process']) mkdirSync(resolve(base, folder), {recursive: true});
const copy = (from, to = from) => cpSync(resolve(trial, from), resolve(base, to), {recursive: true, force: false, errorOnExist: true});
const save = (file, value) => writeFileSync(resolve(base, file + '.json'), JSON.stringify(value, null, 2) + '\n', {flag: 'wx'});
for (const name of ['baseline', 'session-results', ...bookingReceiptPhases]) copy('records/' + name + '.json');
for (const file of readdirSync(resolve(trial, 'records')).filter(name => name.endsWith('-session.jpg')))
  copy('records/' + file, 'original-session-captures/' + file.replace(/-session\.jpg$/, '.jpg'));
for (const name of bookingReceiptImages) execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error',
  '-i', resolve(trial, 'records/' + name + '-session.jpg'), '-vf', 'crop=200:444:484:105:exact=1',
  '-frames:v', '1', '-q:v', '2', '-pix_fmt', 'yuvj444p', resolve(base, 'captures/' + name + '.jpg')], {stdio: 'pipe'});
copy('process');
save('summary', {scope: 'physical-android-controlled-adult-booking-reply-loss-not-release',
  appSourceBaseline: 'b015934047595fab4925d066e331abf86659a778', controllerBaseCommit: '2467e062bda521e9154f5e5c9945914bd5c5bcdd',
  controllerSourcesBoundByHash: true, runId: phone.runId, sourceApkSha256: phone.sourceApkSha256,
  testedAt: phone.checks.at(-1).observedAt, recordCheckpoints: phone.checks.length,
  device: 'Google Pixel 9 Pro / Android 15', physicalDevices: 1,
  captureMethod: 'cropped-browser-session-with-retained-original-not-native-export', independentProcessRestartProven: true, ...review});
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
console.log(JSON.stringify(validateBookingReceiptPhone(root)));

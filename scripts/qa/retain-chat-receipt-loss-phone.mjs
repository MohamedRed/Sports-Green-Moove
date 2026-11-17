import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {cpSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync} from 'node:fs';
import {isAbsolute, resolve} from 'node:path';
import {assertLocalEndpointsClosed} from './local-emulator-lifecycle.mjs';
import {chatReceiptLossPhases} from './chat-receipt-loss-checkpoints.mjs';
import {chatReceiptPhoneFolder, chatReceiptPhoneImages, validateChatReceiptPhone} from './chat-receipt-loss-phone-evidence.mjs';

const [trial, failedTrial, helper, firstHelper, reviewPath] = process.argv.slice(2), root = resolve(import.meta.dirname, '../..');
assert([trial, failedTrial, helper, firstHelper, reviewPath].every(path => isAbsolute(path ?? '')));
await assertLocalEndpointsClosed([5001, 5002, 8080, 9000, 9099, 58887, 61140]);
for (const directory of [trial, failedTrial]) for (const name of ['runtime-handoff.json', 'app-session.json'])
  assert(!existsSync(resolve(directory, name)));
for (const path of [helper, firstHelper]) assert(!existsSync(path));
const base = resolve(root, chatReceiptPhoneFolder); assert(!existsSync(base), 'Never overwrite an original attempt');
const read = (directory, file) => JSON.parse(readFileSync(resolve(directory, file)));
const result = read(trial, 'records/session-results.json'), failed = read(failedTrial, 'records/session-results.json');
assert.equal(result.completed, true); assert.equal(failed.completed, false);
const review = JSON.parse(readFileSync(reviewPath)); assert.equal(review.runId, result.runId);
for (const directory of ['records', 'captures', 'original-session-captures', 'failed-attempt']) mkdirSync(resolve(base, directory), {recursive: true});
const copy = (directory, from, to = from) => cpSync(resolve(directory, from), resolve(base, to), {force: false, errorOnExist: true});
const save = (file, value) => writeFileSync(resolve(base, file), JSON.stringify(value, null, 2) + '\n', {flag: 'wx'});
for (const name of ['fixture', 'baseline', 'original-commit', 'session-results', ...chatReceiptLossPhases]) copy(trial, 'records/' + name + '.json');
for (const name of ['session-results', 'baseline', 'parent-ready']) copy(failedTrial, 'records/' + name + '.json', 'failed-attempt/' + name + '.json');
copy(failedTrial, 'conversation-blocked-session.png', 'failed-attempt/conversation-blocked-session.png');
copy(failedTrial, 'uninstalled-session.png', 'failed-attempt/uninstalled-session.png');
const times = {};
for (const name of ['conversation-open', 'driver-unread', 'signed-out', ...chatReceiptPhoneImages]) {
  const file = 'records/' + name + '-session.png';
  times[name] = statSync(resolve(trial, file)).mtime.toISOString(); copy(trial, file, 'original-session-captures/' + name + '.png');
  if (chatReceiptPhoneImages.includes(name)) execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', resolve(trial, file),
    '-vf', 'crop=274:618:615:109:exact=1', '-frames:v', '1', resolve(base, 'captures/' + name + '.png')], {stdio: 'pipe'});
}
save('capture-times.json', times); save('review.json', review);
save('disposal.json', {observedAt: new Date().toISOString(), sessionEnded: true, providerUninstallReceiptObserved: true,
  originallyEmptyHostClipboardRestored: true, privateFilesAbsent: true, helperDirectoriesAbsent: true,
  ownedPortsClosed: true, ownedProcessGroupsStopped: true, packageAbsenceIndependentlyVerified: false,
  filteredPackageInventorySupported: false, helperExitCode: 130, runtimeExitCode: 130});
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
for (const record of [result, failed]) for (const [file, expected] of Object.entries(record.sourceFiles)) {
  let bytes = readFileSync(resolve(root, file));
  if (record === failed && file === 'scripts/qa/chat-receipt-loss-proxy.mjs') {
    // Reconstruct the one known pre-commit edit, accepting it only against the original frozen digest.
    bytes = Buffer.from(bytes.toString().replace("'getNotificationInbox', 'listChatConversations', 'listChatBookingOptions', 'listDriverBookingRequests'",
      "'listChatConversations', 'listDriverBookingRequests'"));
  }
  assert.equal(hash(bytes), expected, file);
  const destination = resolve(root, 'docs/release/evidence/source-archive', expected + '.txt');
  if (!existsSync(destination)) writeFileSync(destination, bytes, {flag: 'wx'});
}
const hashes = {}, walk = directory => {for (const entry of readdirSync(resolve(base, directory), {withFileTypes: true})) {
  const path = directory ? directory + '/' + entry.name : entry.name;
  if (entry.isDirectory()) walk(path); else hashes[path] = hash(readFileSync(resolve(base, path)));
}}; walk(''); save('artifact-sha256.json', hashes);
console.log(JSON.stringify(validateChatReceiptPhone(root)));

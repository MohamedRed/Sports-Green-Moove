import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync} from 'node:fs';
import {isAbsolute, resolve} from 'node:path';

const [trial] = process.argv.slice(2), root = resolve(import.meta.dirname, '../..');
assert.equal(process.argv.length, 3); assert(isAbsolute(trial ?? ''));
const folder = resolve(root, 'docs/release/evidence/chat-draft-replay-phone-2026-10-31');
assert(!existsSync(folder), 'Never replace an original trial');
const read = name => JSON.parse(readFileSync(resolve(trial, name)));
const result = read('observer/results.json'), disposal = read('disposal.json');
assert.equal(result.completed, true); assert.equal(result.failed, false);
assert.equal(result.checkpoints.length, 7);
assert(result.checkpoints.every(row => row.zeroMessages && row.zeroNotifications && row.protectedRecordsUnchanged));
for (const key of ['privateSessionAbsent', 'runtimeAbsent', 'helperDirectoryAbsent', 'helperGroupExitVerified',
  'sessionEnded', 'signedOutObserved', 'hostClipboardRestored']) assert.equal(disposal[key], true);
assert.equal(disposal.ports.closed, true);
const sha = bytes => createHash('sha256').update(bytes).digest('hex'), files = [];
mkdirSync(folder); mkdirSync(resolve(folder, 'observer')); mkdirSync(resolve(folder, 'captures'));
const save = (name, bytes) => {writeFileSync(resolve(folder, name), bytes, {flag: 'wx'}); files.push(name);};
const copy = name => save(name, readFileSync(resolve(trial, name)));
const json = (name, value) => save(name, JSON.stringify(value, null, 2) + '\n');
for (const name of readdirSync(resolve(trial, 'observer'))) {assert(name.endsWith('.json')); copy('observer/' + name);}
const names = ['01-draft-keyboard', '02-conversation-reopened', '03-system-app-info', '04-provider-reopened',
  '05-before-os-stop', '06-os-stop-confirm', '07-os-stopped', '08-os-reopened'];
for (const name of names) for (const kind of ['context', 'app']) copy('captures/' + name + '-' + kind + '.png');
copy('captures/09-signed-out-context.png'); copy('disposal.json');
json('capture-times.json', Object.fromEntries(files.filter(name => name.startsWith('captures/'))
  .map(name => [name, statSync(resolve(trial, name)).mtime.toISOString()])));
const commit = '86746f4c1a9c58a583073e0f64292ec1146cda90';
const candidate = ['services/ConversationDraftStorage.kt', 'services/SharedPreferencesConversationDrafts.kt',
  'ui/ConversationDraftState.kt', 'ui/ConversationDraftScreen.kt', 'ui/ConversationRoute.kt', 'ui/MessagesRoute.kt']
  .map(path => 'android/app/src/main/java/be/sportgreenmoove/app/' + path);
const sources = {...result.sourceFiles};
for (const path of candidate) sources[path] = sha(execFileSync('git', ['show', commit + ':' + path], {cwd: root}));
for (const [path, digest] of Object.entries(sources)) {
  const bytes = execFileSync('git', ['show', commit + ':' + path], {cwd: root});
  assert.equal(sha(bytes), digest); assert.equal(sha(readFileSync(resolve(root, path))), digest);
  const target = resolve(root, 'docs/release/evidence/source-archive', digest + '.txt');
  if (existsSync(target)) assert.deepEqual(readFileSync(target), bytes); else writeFileSync(target, bytes, {flag: 'wx'});
}
json('source-files.json', sources);
const apk = readFileSync(resolve(trial, 'sgm-chat-draft-86746f4.apk'));
assert.equal(sha(apk), 'f707cb41e5b59147acc9e94c69115edbe6dc95c528b52586fb36c83eefe524e8');
json('apk-provenance.json', {sourceCommit: commit, filename: 'sgm-chat-draft-86746f4.apk', sha256: sha(apk),
  packageName: 'be.sportgreenmoove.app.local', projectId: 'demo-sgm-local-qa', emulatorHost: '127.0.0.1',
  realMapsUi: false, selectedFilenameObserved: true, installedBytesIndependentlyAttested: false});
json('review.json', {reviewedAt: '2026-10-31', scope: 'physical-unsent-draft-restored-after-android-settings-force-stop',
  device: {model: 'Google Pixel 9 Pro', android: '15.0', physical: true},
  sameConversationReopenRestoresDraft: true, keyboardAndComposerVisible: true, sameVisibleDraftRestored: true,
  androidForceStopEnabledBefore: true, androidForceStopConfirmationObserved: true, androidForceStopDisabledAfter: true,
  openedInstalledAppWithoutReinstall: true, authenticatedHomeReturned: true,
  stopMechanism: 'android-app-info-force-stop-confirmation', independentProcessIdsObserved: false,
  providerKillCompletionAccepted: false, providerDevToolsUnavailable: true,
  captureKind: 'original-session-window-crops-not-native-exports', captureClip: {x: 484, y: 110, width: 200, height: 435},
  publishedCaptures: ['01-draft-keyboard', '08-os-reopened'], independentZeroMessageCheckpoints: 7,
  privateHelper: {ports: [5001, 8080, 9000, 9099], aliasEnabled: false, forceLocal: false, requestLoggingEnabled: false},
  ...Object.fromEntries(['actualMessageSendAccepted', 'accountSwitchOnPhoneAccepted', 'pendingSendRestartAccepted',
    'realRadioLossAccepted', 'trackingAccepted', 'peerPhoneAccepted', 'iOSAccepted', 'productionWrites',
    'realPayments', 'applicationDeployed', 'releaseAccepted'].map(key => [key, false])), mapsRequests: 0});
json('artifact-sha256.json', Object.fromEntries(files.map(name => [name, sha(readFileSync(resolve(folder, name)))])));
console.log('Original Android force-stop UI sequence retained; PID, send, peer-phone and release proof remain excluded.');

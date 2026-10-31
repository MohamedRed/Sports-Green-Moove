import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync} from 'node:fs';
import {isAbsolute, resolve} from 'node:path';
import {XMLParser} from 'fast-xml-parser';

const [trial] = process.argv.slice(2), root = resolve(import.meta.dirname, '../..');
assert.equal(process.argv.length, 3); assert(isAbsolute(trial ?? ''));
const folder = resolve(root, 'docs/release/evidence/chat-draft-phone-2026-10-31');
assert(!existsSync(folder), 'Never replace an original trial');
const read = name => JSON.parse(readFileSync(resolve(trial, name)));
const result = read('observer/results.json'), disposal = read('disposal.json');
assert.equal(result.completed, true); assert.equal(result.failed, false);
assert.equal(result.checkpoints.length, 7); assert(result.checkpoints.every(row => row.zeroMessages && row.zeroNotifications));
for (const key of ['privateSessionAbsent', 'runtimeAbsent', 'helperDirectoryAbsent', 'helperGroupExitVerified']) assert.equal(disposal[key], true);
assert.equal(disposal.ports.closed, true);
const sha = bytes => createHash('sha256').update(bytes).digest('hex'), files = [];
mkdirSync(folder); mkdirSync(resolve(folder, 'observer')); mkdirSync(resolve(folder, 'captures')); mkdirSync(resolve(folder, 'units'));
const save = (name, bytes) => {writeFileSync(resolve(folder, name), bytes, {flag: 'wx'}); files.push(name);};
const copy = (name, destination = name) => save(destination, readFileSync(resolve(trial, name)));
for (const name of readdirSync(resolve(trial, 'observer'))) {assert(name.endsWith('.json')); copy('observer/' + name);}
for (const name of readdirSync(resolve(trial, 'captures'))) {assert(name.endsWith('.png')); copy('captures/' + name);}
for (const name of ['process-before.json', 'process-stopped.json', 'process-after.json', 'disposal.json']) copy(name);
for (const phase of ['before', 'stopped', 'after']) copy('process-' + phase + '-ax.txt');
const archive = sources => {
  for (const [path, digest] of Object.entries(sources)) {
    let bytes = readFileSync(resolve(root, path));
    if (sha(bytes) !== digest) bytes = execFileSync('git', ['show', 'HEAD:' + path], {cwd: root});
    assert.equal(sha(bytes), digest, 'Executed source must match its retained bytes');
    const target = resolve(root, 'docs/release/evidence/source-archive', digest + '.txt');
    if (existsSync(target)) assert.deepEqual(readFileSync(target), bytes); else writeFileSync(target, bytes, {flag: 'wx'});
  }
};
archive(result.sourceFiles);
const candidate = ['services/ConversationDraftStorage.kt', 'services/SharedPreferencesConversationDrafts.kt',
  'ui/ConversationDraftState.kt', 'ui/ConversationDraftScreen.kt', 'ui/ConversationRoute.kt', 'ui/MessagesRoute.kt']
  .map(path => 'android/app/src/main/java/be/sportgreenmoove/app/' + path);
candidate.push('android/app/src/test/java/be/sportgreenmoove/app/ui/ConversationDraftStateTest.kt',
  'android/app/src/androidTest/java/be/sportgreenmoove/app/ui/ConversationDraftPersistenceTest.kt',
  'android/app/src/androidTest/java/be/sportgreenmoove/app/ui/ConversationDraftFlowTest.kt');
const candidateSources = Object.fromEntries(candidate.map(path => [path, sha(readFileSync(resolve(root, path)))]));
archive(candidateSources); save('candidate-sources.json', JSON.stringify(candidateSources, null, 2) + '\n');
const parser = new XMLParser({ignoreAttributes: false});
for (const [name, expected] of [['ConversationDraftStateTest', 9], ['ConversationComposerStateTest', 7], ['TeamConversationDraftStateTest', 10]]) {
  const bytes = readFileSync(resolve(root, `android/app/build/test-results/testDebugUnitTest/TEST-be.sportgreenmoove.app.ui.${name}.xml`));
  const suite = parser.parse(bytes.toString()).testsuite;
  assert.equal(Number(suite['@_tests']), expected);
  for (const field of ['failures', 'errors', 'skipped']) assert.equal(Number(suite['@_' + field]), 0);
  save('units/' + name + '.xml', bytes);
}
save('apk-provenance.json', readFileSync(resolve(root, 'docs/release/evidence/search-departure-2026-10-31/candidate/apk.json')));
save('review.json', JSON.stringify({reviewedAt: '2026-10-31', scope: 'physical-unsent-chat-draft-loss-and-local-candidate-not-repair-acceptance',
  device: {model: 'Google Pixel 9 Pro', android: '15.0', physical: true},
  keyboardAndComposerVisible: true, sameConversationReopenRestoresDraft: true,
  physicalProcessRestartObserved: true, draftRestoredAfterProcessRestart: false, phoneCorrectionAccepted: false,
  exactDraft: 'brouillon prive qa avant fermeture', captureKind: 'original-session-window-crops-not-native-exports',
  captureClip: {x: 459, y: 110, width: 200, height: 435}, publishedCaptureCount: 3,
  independentZeroMessageCheckpoints: 7, localDraftUnitCasesPassed: 9, existingComposerUnitCasesPassed: 7,
  existingTeamDraftUnitCasesPassed: 10, candidateInstrumentationCasesCompiled: 5, candidateInstrumentationExecuted: false,
  signedOutObserved: true, providerUninstallAcknowledged: true, packageAbsenceIndependentlyVerified: false,
  sessionEnded: true, hostClipboardRestored: true, installedBytesIndependentlyAttested: false,
  privateHelper: {ports: [5001, 8080, 9000, 9099], aliasEnabled: false, forceLocal: false, requestLoggingEnabled: false},
  realRadioLossAccepted: false, trackingAccepted: false, actualMessageSendAccepted: false, peerPhoneAccepted: false,
  iOSAccepted: false, productionWrites: false, mapsRequests: 0, realPayments: false, applicationDeployed: false, releaseAccepted: false,
}, null, 2) + '\n');
save('artifact-sha256.json', JSON.stringify(Object.fromEntries(files.map(name => [name, sha(readFileSync(resolve(folder, name)))])), null, 2) + '\n');
console.log('Original negative phone trial and separate locally tested candidate retained; physical repair remains unverified.');

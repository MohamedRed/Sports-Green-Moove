import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync} from 'node:fs';
import {dirname, isAbsolute, resolve} from 'node:path';
import {chatNetworkPhonePhases, verifyChatNetworkPhoneCheckpoint} from './chat-network-phone-checkpoints.mjs';

const trial = process.argv[2], root = resolve(import.meta.dirname, '../..');
assert.equal(process.argv.length, 3); assert(isAbsolute(trial ?? ''));
const destination = resolve(root, 'docs/release/evidence/chat-network-phone-2026-10-31');
assert(!existsSync(destination), 'A completed trial cannot be overwritten');
const json = path => JSON.parse(readFileSync(resolve(trial, path)));
const result = json('records/results.json'), baseline = json('records/baseline.json');
assert.equal(result.completed, true); assert.equal(result.failed, false);
assert.deepEqual(result.checkpoints.map(row => row.phase), chatNetworkPhonePhases);
for (const phase of chatNetworkPhonePhases)
  verifyChatNetworkPhoneCheckpoint(phase, baseline, json('records/' + phase + '.json').state, result.fixture);
assert(!existsSync(resolve(trial, 'runtime/session.private.json')));
assert(!existsSync('/var/folders/b4/qz25f4f94vx9h0tv1d4xs3k80000gn/T/sgm-local-runtime-F6iSFq'));
assert(!existsSync('/var/folders/b4/qz25f4f94vx9h0tv1d4xs3k80000gn/T/sgm-scoped-bs-Xw0Hbo'));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const output = mkdtempSync(resolve(dirname(destination), '.chat-phone-stage-'));
try {
  mkdirSync(resolve(output, 'records')); mkdirSync(resolve(output, 'captures'));
  const files = [], save = (path, value) => {writeFileSync(resolve(output, path), value, {flag: 'wx'}); files.push(path);};
  const copy = (from, to) => save(to, readFileSync(from));
  const record = (path, value) => save(path, JSON.stringify(value, null, 2) + '\n');
  for (const file of ['baseline', 'fixture', 'results', ...chatNetworkPhonePhases])
    copy(resolve(trial, 'records', file + '.json'), 'records/' + file + '.json');
  for (const file of ['phone-disposal.json', 'uninstall-observation.json', 'network-offline.json',
    'network-restored.json', 'network-restored-confirmed.json', 'network-default-observation.txt']) copy(resolve(trial, file), file);
  for (const name of ['conversation-empty', 'offline-draft', 'offline-unconfirmed', 'online-before-retry', 'parent-sent', 'reply-read', 'signed-out'])
    copy(resolve(trial, 'captures', name + '.jpg'), 'captures/' + name + '.jpg');
  copy(resolve(root, 'docs/release/evidence/search-departure-2026-10-31/candidate/apk.json'), 'apk-provenance.json');
  copy(resolve(root, 'docs/release/evidence/search-departure-2026-10-31/final/source-sha256.json'), 'app-source-sha256.json');
  for (const [path, digest] of Object.entries(result.sourceFiles)) {
    const bytes = readFileSync(resolve(root, path)); assert.equal(sha(bytes), digest);
    const archive = resolve(root, 'docs/release/evidence/source-archive', digest + '.txt');
    if (existsSync(archive)) assert.deepEqual(readFileSync(archive), bytes); else writeFileSync(archive, bytes, {flag: 'wx'});
  }
  record('disposal.json', {observedAt: new Date().toISOString(), observerExitCode: 0, backendExitCode: 130,
    helperExitCode: 130, helperGroupExitVerified: true, privateSessionAbsent: true,
    runtimeAbsent: true, helperDirectoryAbsent: true, closedPorts: [5001, 8080, 9000, 9099]});
  const names = ['offline-unconfirmed', 'online-before-retry', 'parent-sent', 'reply-read'];
  record('review.json', {scope: 'physical-android-controlled-offline-chat-retry-with-sdk-peer-not-real-radio-loss',
    reviewedAt: '2026-10-31', projectId: result.projectId, runId: result.runId,
    device: {model: 'Google Pixel 9 Pro', android: '15.0', physical: true}, checkpointCount: 8,
    physicalControlledOfflineRetryAccepted: true, independentStoredMessages: 2, independentStoredNotifications: 2,
    automaticSendBeforeRetryObserved: false, parentMessageSentByController: false, driverReplySentByController: true,
    captureKind: 'original-session-window-crops-not-native-device-exports',
    captureClip: {x: 452, y: 98, width: 216, height: 457},
    publishedCaptures: Object.fromEntries(names.map(name => ['chat-phone-' + name, 'captures/' + name + '.jpg'])),
    privateHelperScope: {ports: [5001, 8080, 9000, 9099], forceLocal: false, aliasEnabled: false, requestLoggingEnabled: false},
    realWorldRadioLossAccepted: false, lostResponseAfterCommitAccepted: false, physicalTrackingAccepted: false,
    independentProcessRestartAccepted: false, peerPhoneAccepted: false, pushDeliveryAccepted: false,
    installedBytesIndependentlyAttested: false, packageAbsenceIndependentlyMeasured: false,
    mapsRequests: 0, realPaymentsExercised: false, productionWrites: false, iOSAccepted: false,
    fullNativeGateAccepted: false, priorCopyFailureFixed: false, releaseAccepted: false});
  record('artifact-sha256.json', Object.fromEntries(files.map(file => [file, sha(readFileSync(resolve(output, file)))])));
  renameSync(output, destination); console.log(JSON.stringify({retained: destination, checkpoints: 8, publishedCaptures: 4}));
} finally {rmSync(output, {recursive: true, force: true});}

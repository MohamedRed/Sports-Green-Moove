import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync} from 'node:fs';
import {isAbsolute, resolve} from 'node:path';
import {supportRecheckFolder, supportRecheckHead, validateSupportRecheck, validateSupportRecheckCi} from './support-recovery-recheck-evidence.mjs';

const [input] = process.argv.slice(2); assert(isAbsolute(input ?? ''));
const root = resolve(import.meta.dirname, '../..'), base = resolve(root, supportRecheckFolder);
assert(!existsSync(base), 'Never overwrite an original collection');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const save = (file, value) => {
  mkdirSync(resolve(base, file, '..'), {recursive: true});
  writeFileSync(resolve(base, file), typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value, null, 2) + '\n', {flag: 'wx'});
};
const copy = (from, to) => {mkdirSync(resolve(base, to, '..'), {recursive: true}); copyFileSync(from, resolve(base, to), 1);};
for (const file of readdirSync(resolve(input, 'support-phone-a1-records'))) {
  assert(/^(prepared|committed|offline|uncertain|reopened|confirmed|foreign|restored|session-results)\.json$/.test(file));
  copy(resolve(input, 'support-phone-a1-records', file), 'checkpoints/' + file);
}
for (const file of readdirSync(resolve(input, 'support-phone-a1-gate'))) {
  assert(/^(held|release|released|attempt-[a-f0-9-]+)\.json$/.test(file), file);
  copy(resolve(input, 'support-phone-a1-gate', file), 'gate/' + file);
}
for (const name of ['before', 'stopped', 'reopened', 'package-removed'])
  copy(resolve(input, 'support-phone-a1-' + (name === 'package-removed' ? name : 'process-' + name) + '.txt'), 'process/' + name + '.txt');
for (const name of ['ui-closure', 'host-disposal']) copy(resolve(input, `support-phone-a1-${name}.json`), name + '.json');
copy(resolve(input, 'support-phone-a1d0d96-build.txt'), 'build.txt');
for (const file of readdirSync(resolve(input, 'support-phone-a1-images'))) {
  assert(/^(0[1-9]|10)-[a-z-]+\.png$/.test(file)); copy(resolve(input, 'support-phone-a1-images', file), 'captures/' + file);
}
const apk = readFileSync(resolve(input, 'sgm-support-phone-a1d0d96.apk'));
save('apk-binding.json', {sourceCommit: supportRecheckHead, sha256: sha(apk), bytes: apk.length,
  package: 'be.sportgreenmoove.app.local', emulatorHost: '127.0.0.1', emulatorEnabled: true,
  scope: 'host-built-and-uploaded-apk-not-independent-installed-byte-hash', sourceCleanAtBuildObserved: true});
save('observations.json', {scope: 'manual-session-observations-not-independent-radio-causality',
  networkMethod: 'provider-offline-mode-0kbps-not-persistent-wifi-disable',
  offlineCaptureFileModifiedAt: statSync(resolve(input, 'support-phone-a1-images/02-offline-full.png')).mtime.toISOString(),
  parentHistoryRows: 2, newReports: 1, preexistingProtectedReports: 1, newVideo: false,
  recordingFailure: 'desktop-screen-sharing-permission-modal-no-permission-change',
  captures: 'original-browser-session-captures-not-native-exports', parentIdentity: 'p@example.test', foreignIdentity: 'd@example.test',
  foreignFormEmptyObserved: true, foreignHistoryEmptyObserved: true, parentHistoryRestoredObserved: true,
  newPublicCapture: {file: 'captures/10-parent-history-session.png', clip: {x: 460, y: 111, width: 198, height: 435}},
  retainedArtifactsExcludeCredentialEntry: true, mapRequests: 0, realPayments: 0, realEmails: 0, productionWrites: false});
const gh = args => execFileSync('gh', args, {encoding: 'utf8', timeout: 60_000, maxBuffer: 4 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe']});
save('ci/native-run.json', gh(['run', 'view', '41079831206', '--repo', 'MohamedRed/Sports-Green-Moove', '--json', 'databaseId,headSha,status,conclusion,jobs,url']));
save('ci/web-run.json', gh(['run', 'view', '41079831287', '--repo', 'MohamedRed/Sports-Green-Moove', '--json', 'databaseId,headSha,status,conclusion,jobs,url']));
save('ci/artifact.json', gh(['api', 'repos/MohamedRed/Sports-Green-Moove/actions/artifacts/12989843943']));
const ordinary = resolve(input, 'a1d0d96-main/outputs/store-review-screenshots');
for (const file of ['ordinary-instrumentation.txt', 'ordinary-results.json', 'native-suite-status.json', 'disposable-store-restore.json'])
  copy(resolve(ordinary, file), 'ci/' + file);
const replay = resolve(input, 'a1d0d96-main/outputs/local-ui-evidence/f6aa1e22b9e6372e50cfc4149eec57d1');
assert(!existsSync(resolve(replay, 'results.json')));
for (const file of readdirSync(replay).filter(file => file.endsWith('-instrumentation.txt') || /^adb-pull-.*\.json$/.test(file) ||
  /trip-change-parent-confirmation-(diagnostics\.json|crash\.txt|exit-info\.txt|install-sessions\.txt)$/.test(file)))
  copy(resolve(replay, file), 'ci/replay/' + file);
const sources = {}, files = [
  'android/app/build.gradle.kts', 'scripts/qa/start-support-recovery-ui.mjs', 'scripts/qa/install-support-response-gate.mjs',
  'scripts/qa/support-submission-response-gate.mjs', 'scripts/qa/manual-support-recovery-session.mjs',
  'scripts/qa/manual-support-recovery-checkpoints.mjs', 'scripts/qa/support-recovery-protocol.mjs',
  'scripts/qa/local-runtime.mjs', 'scripts/qa/local-ui-session.mjs', 'scripts/qa/supervised-local-process.mjs',
  'android/app/src/main/java/be/sportgreenmoove/app/services/FirebaseAndroidRuntime.kt',
  'android/app/src/main/java/be/sportgreenmoove/app/services/FirebaseAndroidGateway.kt',
  'android/app/src/main/java/be/sportgreenmoove/app/ui/OptionsReportCard.kt',
  ...execFileSync('git', ['ls-tree', '-r', '--name-only', supportRecheckHead, 'functions/src', 'android/app/src/main'], {encoding: 'utf8'})
    .split('\n').filter(file => /[Ss]upport/.test(file)),
];
for (const file of files) {
  const bytes = execFileSync('git', ['show', supportRecheckHead + ':' + file]); sources[file] = sha(bytes);
  const archive = resolve(root, 'docs/release/evidence/source-archive', sources[file] + '.txt');
  if (existsSync(archive)) assert.deepEqual(readFileSync(archive), bytes); else writeFileSync(archive, bytes, {flag: 'wx'});
}
save('source-sha256.json', sources);
save('summary.json', {scope: 'physical-support-retry-after-controlled-offline-and-process-stop-not-radio-or-release-proof',
  checkedAt: '2026-10-30', sourceCommit: supportRecheckHead, apkSha256: sha(apk), physicalDevice: true,
  nativeProcessStopVerified: true, draftRestoredWithoutRetyping: true, explicitRetryObserved: true, originalReportUnchanged: true,
  accountIsolationObserved: true, controlledOfflineObserved: true, hostDisposalVerified: true,
  physicalRadioLossVerified: false, trackingNetworkLossVerified: false, urgentEscalationVerified: false, realEmailSent: false,
  earlierReplayRootCauseEstablished: false, handlerClosedBeforeReleaseVerified: false, installedBytesIndependentlyHashed: false,
  fullCiPassed: false, releaseComplete: false, productionWrites: false, videoRecorded: false, iosPhysicalUiVerified: false,
  publishedCaptures: {'support-recheck-history': 'captures/10-parent-history-session.png'}});
const hashes = {};
for (const entry of readdirSync(base, {recursive: true, withFileTypes: true}).filter(row => row.isFile())) {
  const path = resolve(entry.parentPath, entry.name); hashes[path.slice(base.length + 1)] = sha(readFileSync(path));
}
save('artifact-sha256.json', hashes);
validateSupportRecheck(root); console.log(JSON.stringify(validateSupportRecheckCi(root)));

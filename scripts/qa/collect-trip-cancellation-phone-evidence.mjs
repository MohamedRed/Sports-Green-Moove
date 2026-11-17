import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync, spawnSync} from 'node:child_process';
import {cpSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import net from 'node:net';
import {cancellationCaptureNames, cancellationEvidenceDirectory, validateCancellationPhoneEvidence} from './trip-cancellation-phone-evidence.mjs';

const [trial] = process.argv.slice(2), root = resolve(import.meta.dirname, '../..');
assert.equal(trial, '/private/tmp/sgm-cancellation-phone-20261028.OQSo0n');
const base = resolve(root, cancellationEvidenceDirectory);
assert(!existsSync(resolve(base, 'summary.json')), 'Do not overwrite original evidence');
const read = file => JSON.parse(readFileSync(file));
const session = read(resolve(trial, 'observations/session-results.json'));
assert.equal(session.completed, true);
const runtime = '/var/folders/b4/qz25f4f94vx9h0tv1d4xs3k80000gn/T/sgm-local-runtime-icLQeD';
const helper = '/var/folders/b4/qz25f4f94vx9h0tv1d4xs3k80000gn/T/sgm-scoped-bs-5HR1FS';
for (const file of [resolve(trial, 'session.json'), runtime, helper]) assert(!existsSync(file));
for (const pid of [84918, 84948, 84950, 85006]) {
  const observed = spawnSync('/bin/ps', ['-p', String(pid), '-o', 'pid='], {encoding: 'utf8'});
  assert.equal(observed.status, 1); assert.equal(observed.stdout.trim(), '');
}
const ports = [];
for (const port of [5001, 8080, 9000, 9099, 45690, 45691]) {
  await new Promise((yes, no) => {
    const server = net.createServer(); server.once('error', no);
    server.listen(port, '127.0.0.1', () => server.close(error => error ? no(error) : yes()));
  }); ports.push({port, available: true});
}
const save = (file, value) => writeFileSync(resolve(base, file), JSON.stringify(value, null, 2) + '\n');
mkdirSync(resolve(base, 'phone'), {recursive: true});
cpSync(resolve(trial, 'observations'), resolve(base, 'phone/checkpoints'), {recursive: true});
cpSync(resolve(trial, 'captures'), resolve(base, 'captures'), {recursive: true});
for (const name of readdirSync(resolve(base, 'captures')))
  renameSync(resolve(base, 'captures', name), resolve(base, 'captures', name.replace(/\.png$/, '.jpg')));
for (const name of ['process-before-stop-ax', 'process-stopped-ax', 'process-reopened-ax', 'package-removed-ax'])
  cpSync(resolve(trial, name + '.txt'), resolve(base, 'phone', name + '.txt'));
cpSync('/private/tmp/sgm-cancellation-phone-build-20261028.log', resolve(base, 'gradle.txt'));
const config = readFileSync(resolve(root, 'android/app/build/generated/source/buildConfig/debug/be/sportgreenmoove/app/BuildConfig.java'), 'utf8');
assert.match(config, /APPLICATION_ID = "be\.sportgreenmoove\.app\.local"/);
assert.match(config, /SGM_FIREBASE_EMULATOR_HOST = "localhost"/); assert.match(config, /SGM_USE_FIREBASE_EMULATOR = true/);
save('build-configuration.json', {applicationId: 'be.sportgreenmoove.app.local', usesIsolatedServices: true,
  emulatorHost: 'localhost', sourceApkNotInstalledByteProof: true});
save('phone/runtime-disposal.json', {projectId: session.projectId, runId: session.runId, observedAt: new Date().toISOString(),
  listenerIdentityObservedBeforeStop: true, listeners: [{pid: 84918, ports: [5001, 9099]}, {pid: 84948, ports: [8080]}, {pid: 84950, ports: [9000]}],
  helperPid: 85006, ownedProcessesAbsent: true, ports, runtimeAbsent: true, helperDirectoryAbsent: true,
  privateSessionAbsent: true, observerExitCode: 0, runtimeExitCode: 130, helperExitCode: 130,
  stopMethod: 'operator-requested-SIGINT-supervised-launchers-then-independent-pid-path-and-port-checks'});
const paths = Object.keys(session.sourceFiles);
for (const area of ['main', 'debug']) {
  const directory = resolve(root, 'android/app/src', area);
  const walk = folder => {for (const entry of readdirSync(folder, {withFileTypes: true})) {
    const file = resolve(folder, entry.name); if (entry.isDirectory()) walk(file); else paths.push(file.slice(root.length + 1));
  }}; walk(directory);
}
for (const file of ['android/app/build.gradle.kts', 'android/build.gradle.kts', 'android/settings.gradle.kts']) paths.push(file);
const sources = Object.fromEntries(paths.map(file => [file, createHash('sha256').update(readFileSync(resolve(root, file))).digest('hex')]));
save('native-build-sources.json', sources);
const archive = resolve(root, 'docs/release/evidence/source-archive'); mkdirSync(archive, {recursive: true});
for (const [file, hash] of Object.entries(sources)) {
  const destination = resolve(archive, hash + '.txt'); if (!existsSync(destination)) cpSync(resolve(root, file), destination);
}
save('summary.json', {scope: 'physical-android-whole-trip-cancellation-not-concurrent-race-or-release-proof',
  projectId: session.projectId, runId: session.runId, testedAt: session.testedAt,
  sourceBaselineCommit: execFileSync('git', ['rev-parse', 'HEAD'], {cwd: root, encoding: 'utf8'}).trim(),
  sourceApkSha256: createHash('sha256').update(readFileSync(resolve(trial, 'sgm-trip-cancellation-isolated-ce93-20261028.apk'))).digest('hex'),
  installedBytesIndependentlyVerified: false, device: 'Google Pixel 9 Pro / Android 15', physicalDeviceCount: 1,
  completedCheckpoints: 12, publicCaptureMethod: 'browser-session-window-not-native-export',
  publicCaptureCount: cancellationCaptureNames.length, publicCaptures: cancellationCaptureNames,
  concurrentRaceProven: false, refundDeliveryVerified: false, pushDeliveryVerified: false,
  productionWrites: false, productionDeployed: false, releaseComplete: false, realPaymentExercised: false,
  providerMapRequests: 0, videoAccepted: false, nativeScreenshotExportAccepted: false});
const hashes = {}, walk = directory => {for (const entry of readdirSync(resolve(base, directory), {withFileTypes: true})) {
  const name = directory ? directory + '/' + entry.name : entry.name;
  if (entry.isDirectory()) walk(name);
  else if (!['artifact-sha256.json', 'README.md'].includes(name)) hashes[name] = createHash('sha256').update(readFileSync(resolve(base, name))).digest('hex');
}}; walk(''); save('artifact-sha256.json', hashes);
console.log(JSON.stringify(validateCancellationPhoneEvidence(root)));

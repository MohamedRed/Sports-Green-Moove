import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync} from 'node:fs';
import {homedir} from 'node:os';
import {isAbsolute, resolve} from 'node:path';
import {XMLParser, XMLBuilder} from 'fast-xml-parser';
import {nativeTeamPushSources, nativeTeamPushCases, nativeTeamPushLifecycleSources, nativeTeamPushLifecycleCases} from './native-team-push-sources.mjs';

const root = resolve(import.meta.dirname, '../..'), output = process.argv[2];
const lifecycle = process.argv[3] === '--lifecycle'; assert(process.argv.length === (lifecycle ? 4 : 3));
const sources = lifecycle ? nativeTeamPushLifecycleSources : nativeTeamPushSources;
const cases = lifecycle ? nativeTeamPushLifecycleCases : nativeTeamPushCases;
const focused = Object.values(cases).reduce((sum, count) => sum + count, 0);
assert(isAbsolute(output ?? ''), 'Use a new absolute output directory');
assert(!existsSync(output), 'Never overwrite a trial'); mkdirSync(output, {recursive: true});
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const snapshot = () => Object.fromEntries(sources.map(file => [file, sha(readFileSync(resolve(root, file)))]));
const sourceFiles = snapshot(), startedAt = new Date().toISOString();
const args = [':app:testDebugUnitTest', ':app:assembleDebug', ':app:assembleDebugAndroidTest', '--no-daemon'];
if (lifecycle) args.push('-PSGM_USE_FIREBASE_EMULATOR=true', '-PSGM_FIREBASE_EMULATOR_HOST=localhost', '-PSGM_LOCAL_REAL_MAPS_UI=false',
  ':app:dependencyInsight', '--configuration', 'debugRuntimeClasspath', '--dependency', 'firebase-messaging');
const build = spawnSync('./gradlew', args, {cwd: resolve(root, 'android'), encoding: 'utf8', maxBuffer: 16 * 1024 * 1024});
const log = (build.stdout ?? '') + (build.stderr ?? '');
writeFileSync(resolve(output, 'build.log'), log, {flag: 'wx'});
assert.ifError(build.error); assert.equal(build.status, 0); assert(log.includes('BUILD SUCCESSFUL'));
assert.deepEqual(snapshot(), sourceFiles, 'Source changed during the build');
const parser = new XMLParser({ignoreAttributes: false}), builder = new XMLBuilder({ignoreAttributes: false, format: true});
const folder = resolve(root, 'android/app/build/test-results/testDebugUnitTest'), suites = [], artifacts = {};
const put = (file, bytes) => { writeFileSync(resolve(output, file), bytes, {flag: 'wx'}); artifacts[file] = sha(bytes); };
mkdirSync(resolve(output, 'junit'));
for (const file of readdirSync(folder).filter(name => name.endsWith('.xml')).sort()) {
  const parsed = parser.parse(readFileSync(resolve(folder, file))), suite = parsed.testsuite;
  for (const key of ['failures', 'errors', 'skipped']) assert.equal(Number(suite['@_' + key]), 0);
  suite['@_hostname'] = 'local-test-host';
  put('junit/' + file, builder.build(parsed).split(homedir()).join('<home>'));
  suites.push({name: suite['@_name'], tests: Number(suite['@_tests'])});
}
for (const [name, count] of Object.entries(cases))
  assert.equal(suites.find(row => row.name === 'be.sportgreenmoove.app.services.' + name)?.tests, count);
const total = suites.reduce((sum, row) => sum + row.tests, 0); assert.equal(total, lifecycle ? 746 : 722);
// Keep failed trials private; only retain the reviewed, successful source-bound result.
const retained = resolve(root, 'docs/release/evidence/' + (lifecycle ? 'native-team-push-lifecycle' : 'native-team-push-journal') + '-2026-11-01');
if (existsSync(retained)) assert.deepEqual(readdirSync(retained), ['README.md']); else mkdirSync(retained);
const archive = resolve(root, 'docs/release/evidence/source-archive');
for (const [file, hash] of Object.entries(sourceFiles)) {
  const path = resolve(archive, hash + '.txt'), bytes = readFileSync(resolve(root, file)); assert.equal(sha(bytes), hash);
  if (!existsSync(path)) writeFileSync(path, bytes, {flag: 'wx'}); else assert.equal(sha(readFileSync(path)), hash);
}
const apk = file => { const bytes = readFileSync(resolve(root, 'android/app/build/outputs/apk', file)); return {sha256: sha(bytes), bytes: bytes.length}; };
const report = {scope: lifecycle ? 'native-registration-lifecycle-jvm-and-build-only' : 'native-registration-journal-jvm-and-build-only', startedAt, testedAt: new Date().toISOString(),
  sourceUnchangedDuringBuild: true, unitTests: total, unitSuites: suites.length, focusedUnitTests: focused, focusedSuites: cases,
  appCompiled: true, instrumentationCompiled: true, instrumentationExecuted: false, nativeLifecycleImplemented: lifecycle,
  realPhoneTokenRegistered: false, dispatcherImplemented: false, pushDeliveryVerified: false, tapNavigationVerified: false,
  physicalDevice: false, productionWrites: false, releaseAccepted: false, providerSends: 0, mapRequests: 0,
  sourceFiles, apk: apk('debug/app-debug.apk'), testApk: apk('androidTest/debug/app-debug-androidTest.apk')};
if (lifecycle) {
  const manifest = readFileSync(resolve(root, 'android/app/build/intermediates/merged_manifests/debug/processDebugManifest/AndroidManifest.xml'), 'utf8');
  const app = parser.parse(manifest).manifest.application;
  assert.equal(app['@_android:name'], 'be.sportgreenmoove.app.SgmApplication');
  for (const name of ['firebase_messaging_auto_init_enabled', 'firebase_messaging_notification_delegation_enabled'])
    assert.equal(String(app['meta-data'].find(row => row['@_android:name'] === name)?.['@_android:value']), 'false');
  const service = app.service.find(row => row['@_android:name'] === 'be.sportgreenmoove.app.services.TeamPushMessagingService');
  assert.equal(String(service['@_android:enabled']), 'false'); assert.equal(String(service['@_android:exported']), 'false');
  const config = readFileSync(resolve(root, 'android/app/build/generated/source/buildConfig/debug/be/sportgreenmoove/app/BuildConfig.java'), 'utf8');
  assert(config.includes('SGM_USE_FIREBASE_EMULATOR = true'));
  put('registration-manifest.json', JSON.stringify({applicationClass: app['@_android:name'], autoInit: false,
    delegation: false, service: {name: service['@_android:name'], enabled: false, exported: false}}, null, 2) + '\n');
  assert(log.includes('com.google.firebase:firebase-messaging:25.0.2'));
  Object.assign(report, {isolatedBuild: true, realSdkCallsExecuted: false, runtimeCallbacksExecuted: false,
    authenticatedSignoutRemovalVerified: false, messagingSdkVersion: '25.0.2', automaticRetry: false});
}
put('review.json', JSON.stringify(report, null, 2) + '\n');
put('build-success.txt', log.split(homedir()).join('<home>').split('\n').map(line => line.trimEnd()).join('\n'));
for (const file of Object.keys(artifacts)) {
  const target = resolve(retained, file); mkdirSync(resolve(target, '..'), {recursive: true});
  writeFileSync(target, readFileSync(resolve(output, file)), {flag: 'wx'});
}
writeFileSync(resolve(retained, 'artifact-sha256.json'), JSON.stringify(artifacts, null, 2) + '\n', {flag: 'wx'});
console.log(JSON.stringify({unitTests: total, focusedTests: focused, instrumentationExecuted: false, pushDeliveryVerified: false}));

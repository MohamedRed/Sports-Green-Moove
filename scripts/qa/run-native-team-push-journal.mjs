import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync} from 'node:fs';
import {homedir} from 'node:os';
import {isAbsolute, resolve} from 'node:path';
import {XMLParser, XMLBuilder} from 'fast-xml-parser';
import {nativeTeamPushSources, nativeTeamPushCases} from './native-team-push-sources.mjs';

const root = resolve(import.meta.dirname, '../..'), output = process.argv[2];
assert(isAbsolute(output ?? ''), 'Use a new absolute output directory');
assert(!existsSync(output), 'Never overwrite a trial'); mkdirSync(output, {recursive: true});
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const snapshot = () => Object.fromEntries(nativeTeamPushSources.map(file => [file, sha(readFileSync(resolve(root, file)))]));
const sourceFiles = snapshot(), startedAt = new Date().toISOString();
const args = [':app:testDebugUnitTest', ':app:assembleDebug', ':app:assembleDebugAndroidTest', '--no-daemon'];
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
for (const [name, count] of Object.entries(nativeTeamPushCases))
  assert.equal(suites.find(row => row.name === 'be.sportgreenmoove.app.services.' + name)?.tests, count);
const total = suites.reduce((sum, row) => sum + row.tests, 0); assert(total >= 722);
// Keep failed trials private; only retain the reviewed, successful source-bound result.
const retained = resolve(root, 'docs/release/evidence/native-team-push-journal-2026-11-01');
if (existsSync(retained)) assert.deepEqual(readdirSync(retained), ['README.md']); else mkdirSync(retained);
const archive = resolve(root, 'docs/release/evidence/source-archive');
for (const [file, hash] of Object.entries(sourceFiles)) {
  const path = resolve(archive, hash + '.txt'), bytes = readFileSync(resolve(root, file)); assert.equal(sha(bytes), hash);
  if (!existsSync(path)) writeFileSync(path, bytes, {flag: 'wx'}); else assert.equal(sha(readFileSync(path)), hash);
}
const apk = file => { const bytes = readFileSync(resolve(root, 'android/app/build/outputs/apk', file)); return {sha256: sha(bytes), bytes: bytes.length}; };
const report = {scope: 'native-registration-journal-jvm-and-build-only', startedAt, testedAt: new Date().toISOString(),
  sourceUnchangedDuringBuild: true, unitTests: total, unitSuites: suites.length, focusedUnitTests: 27, focusedSuites: nativeTeamPushCases,
  appCompiled: true, instrumentationCompiled: true, instrumentationExecuted: false, nativeLifecycleImplemented: false,
  realPhoneTokenRegistered: false, dispatcherImplemented: false, pushDeliveryVerified: false, tapNavigationVerified: false,
  physicalDevice: false, productionWrites: false, releaseAccepted: false, providerSends: 0, mapRequests: 0,
  sourceFiles, apk: apk('debug/app-debug.apk'), testApk: apk('androidTest/debug/app-debug-androidTest.apk')};
put('review.json', JSON.stringify(report, null, 2) + '\n');
put('build-success.txt', log.split(homedir()).join('<home>').split('\n').map(line => line.trimEnd()).join('\n'));
for (const file of Object.keys(artifacts)) {
  const target = resolve(retained, file); mkdirSync(resolve(target, '..'), {recursive: true});
  writeFileSync(target, readFileSync(resolve(output, file)), {flag: 'wx'});
}
writeFileSync(resolve(retained, 'artifact-sha256.json'), JSON.stringify(artifacts, null, 2) + '\n', {flag: 'wx'});
console.log(JSON.stringify({unitTests: total, focusedTests: 27, instrumentationExecuted: false, pushDeliveryVerified: false}));

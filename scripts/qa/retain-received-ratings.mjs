import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync, spawnSync} from 'node:child_process';
import {cpSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync} from 'node:fs';
import {isAbsolute, resolve} from 'node:path';
import {tmpdir} from 'node:os';
import net from 'node:net';
import {XMLParser} from 'fast-xml-parser';
import {receivedRatingsFolder, receivedPublicCaptures, validateReceivedRatingsEvidence} from './received-ratings-evidence.mjs';

const [phoneTrial, serviceTrial, helperDirectory, helperPid] = process.argv.slice(2), root = resolve(import.meta.dirname, '../..');
assert([phoneTrial, serviceTrial, helperDirectory].every(path => isAbsolute(path ?? '')) && /^\d+$/.test(helperPid ?? ''));
assert(!existsSync(resolve(phoneTrial, 'private/session.json')) && !existsSync(helperDirectory));
assert(!readdirSync(tmpdir()).some(name => name.startsWith('sgm-local-runtime-')));
const processCheck = spawnSync('/bin/ps', ['-p', helperPid, '-o', 'pid='], {encoding: 'utf8'});
assert.equal(processCheck.status, 1); assert.equal(processCheck.stdout.trim(), '');
const ports = [];
for (const port of [5001, 8080, 9000, 9099, 45690, 45691]) {
  await new Promise((yes, no) => {
    const server = net.createServer(); server.once('error', no);
    server.listen(port, '127.0.0.1', () => server.close(error => error ? no(error) : yes()));
  }); ports.push({port, available: true});
}
const base = resolve(root, receivedRatingsFolder); assert(!existsSync(base), 'Never replace original evidence');
const read = file => JSON.parse(readFileSync(file));
const phone = read(resolve(phoneTrial, 'records/session-results.json'));
const service = read(resolve(serviceTrial, 'received-ratings-services-second.json'));
const first = read(resolve(serviceTrial, 'received-ratings-services-first.json'));
const window = read(resolve(serviceTrial, 'review-request-window.json'));
assert(phone.completed && service.completed && window.gapReproduced);
mkdirSync(base, {recursive: true});
const save = (name, value) => writeFileSync(resolve(base, name + '.json'), JSON.stringify(value, null, 2) + '\n', {flag: 'wx'});
cpSync(resolve(phoneTrial, 'records'), resolve(base, 'phone'), {recursive: true});
cpSync(resolve(phoneTrial, 'captures'), resolve(base, 'captures'), {recursive: true});
cpSync(resolve(phoneTrial, 'ui-review.json'), resolve(base, 'ui-review.json'));
save('service', service); save('first-preparation', first); save('review-window-gap', window);
for (const [from, to] of [['received-ratings-backend-units.log', 'backend-units.txt'],
  ['received-ratings-android-build-final.log', 'android-build.txt'], ['received-ratings-android-build-first.log', 'first-android-build.txt'],
  ['received-ratings-first-controller.mjs.txt', 'first-controller.mjs.txt'], ['received-ratings-first-runner.mjs.txt', 'first-runner.mjs.txt']])
  cpSync(resolve(serviceTrial, from), resolve(base, to));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const archive = resolve(root, 'docs/release/evidence/source-archive'); mkdirSync(archive, {recursive: true});
const retain = (file, expected, bytes) => {
  assert.equal(hash(bytes), expected, file); const destination = resolve(archive, expected + '.txt');
  if (!existsSync(destination)) writeFileSync(destination, bytes, {flag: 'wx'});
};
for (const report of [first, service, phone, window]) for (const [file, expected] of Object.entries(report.sourceFiles)) {
  const bytes = report === first && file === 'scripts/qa/local-received-ratings.mjs'
    ? readFileSync(resolve(base, 'first-controller.mjs.txt')) : readFileSync(resolve(root, file));
  retain(file, expected, bytes);
}
const nativeFiles = ['android/app/build.gradle.kts', ...['data/ReceivedRatingSummary.kt', 'services/ReceivedRatingsGateway.kt',
  'services/FirebaseAndroidReceivedRatingsGateway.kt', 'services/FirebaseAndroidRuntime.kt', 'ui/ProfileReceivedRatings.kt',
  'ui/ReceivedRatingsState.kt', 'ui/ProfileScreen.kt', 'ui/ProfileRoute.kt', 'ui/SportsGreenMooveApp.kt', 'ui/V2Components.kt',
  'design/SgmTheme.kt'].map(file => 'android/app/src/main/java/be/sportgreenmoove/app/' + file)];
const nativeSources = Object.fromEntries(nativeFiles.map(file => [file, hash(readFileSync(resolve(root, file)))]));
for (const [file, expected] of Object.entries(nativeSources)) retain(file, expected, readFileSync(resolve(root, file)));
save('native-sources', nativeSources);
const unitDirectory = resolve(root, 'android/app/build/test-results/testDebugUnitTest'), parser = new XMLParser({ignoreAttributes: false});
const units = {tests: 0, failures: 0, errors: 0, skipped: 0};
for (const file of readdirSync(unitDirectory).filter(name => name.endsWith('.xml'))) {
  const suite = parser.parse(readFileSync(resolve(unitDirectory, file), 'utf8')).testsuite;
  for (const key of Object.keys(units)) units[key] += Number(suite['@_' + key] ?? 0);
  if (/ReceivedRatings(?:Parser|State)Test/.test(file)) cpSync(resolve(unitDirectory, file), resolve(base, file));
}
save('android-unit-counts', units);
const config = readFileSync(resolve(root, 'android/app/build/generated/source/buildConfig/debug/be/sportgreenmoove/app/BuildConfig.java'), 'utf8');
assert.match(config, /SGM_USE_FIREBASE_EMULATOR = true/); assert.match(config, /SGM_FIREBASE_EMULATOR_HOST = "localhost"/);
const ordinary = read(resolve(phoneTrial, 'previous-ci/outputs/store-review-screenshots/ordinary-results.json'));
const transcript = readFileSync(resolve(phoneTrial, 'previous-ci/outputs/store-review-screenshots/ordinary-instrumentation.txt'), 'utf8');
const start = transcript.indexOf('There was 1 failure:'); assert(start >= 0);
writeFileSync(resolve(base, 'prior-ci-capture-failure.txt'), transcript.slice(start), {flag: 'wx'});
const jobs = JSON.parse(execFileSync('gh', ['run', 'view', '40926872921', '--repo', 'MohamedRed/Sports-Green-Moove', '--json', 'headSha,status,conclusion,jobs'], {encoding: 'utf8'}));
assert.equal(jobs.headSha, '5246a079e1f02af234697111cbc2c1e3f70f3f3c'); assert.equal(jobs.status, 'completed');
const sdkLog = execFileSync('gh', ['api', 'repos/MohamedRed/Sports-Green-Moove/actions/jobs/123634606959/logs'], {encoding: 'utf8', maxBuffer: 24 * 1024 * 1024});
const sdkFailure = sdkLog.split('\n').filter(line => /Error on ZipFile unknown archive/.test(line)); assert.equal(sdkFailure.length, 1);
writeFileSync(resolve(base, 'prior-ci-sdk-failure.txt'), sdkFailure.join('\n') + '\n', {flag: 'wx'});
save('prior-ci', {head: jobs.headSha, runId: 40926872921, fullNativeGatePassed: false,
  ordinary: {passed: ordinary.passed, failed: ordinary.failed, skipped: ordinary.skipped, failedCases: ordinary.cases.filter(row => row.status === 'failed')},
  jobs: jobs.jobs.map(({name, status, conclusion}) => ({name, status, conclusion})),
  scopedSdkCaseStarted: false, source: 'terminal-original-5246a07-before-received-rating-implementation'});
save('summary', {scope: 'received-rating-summary-on-one-isolated-physical-android-not-release', testedAt: phone.testedAt,
  physicalDeviceCount: 1, accountsTested: 3, sourceApkSha256: phone.sourceApkSha256,
  sourceBaselineCommit: jobs.headSha, implementationWasUncommittedAtBuild: true,
  publicCaptureMethod: 'browser-session-window-not-native-export', publicCaptures: receivedPublicCaptures,
  installedBytesIndependentlyVerified: false, processRestartProven: false, phoneRatingSubmissionProven: false,
  longReviewDiscoveryFixed: false, iosProfileImplemented: false, productionDeployed: false, productionWrites: false,
  releaseComplete: false, videoAccepted: false, componentTestsExecutedLocally: false, providerMapRequests: 0, realPaymentExercised: false});
save('disposal', {observedAt: new Date().toISOString(), observerExitCode: 0, runtimeExitCode: 130, helperExitCode: 130,
  privateSessionAbsent: true, helperDirectoryAbsent: true, helperProcessAbsent: true, noLocalRuntimeDirectories: true, ports});
const hashes = {}, walk = directory => {for (const entry of readdirSync(resolve(base, directory), {withFileTypes: true})) {
  const file = directory ? directory + '/' + entry.name : entry.name;
  if (entry.isDirectory()) walk(file); else hashes[file] = hash(readFileSync(resolve(base, file)));
}}; walk(''); save('artifact-sha256', hashes);
console.log(JSON.stringify(validateReceivedRatingsEvidence(root)));

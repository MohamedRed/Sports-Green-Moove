import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {cpSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync} from 'node:fs';
import {isAbsolute, resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {XMLParser} from 'fast-xml-parser';
import {assertLocalEndpointsClosed} from './local-emulator-lifecycle.mjs';
import {reviewPaginationFolder, reviewPaginationPublicCaptures, validateReviewPaginationEvidence} from './review-pagination-evidence.mjs';

const [trial, helperDirectory, helperPid] = process.argv.slice(2), root = resolve(import.meta.dirname, '../..');
assert([trial, helperDirectory].every(path => isAbsolute(path ?? '')) && /^\d+$/.test(helperPid ?? ''));
assert(!existsSync(resolve(trial, 'private/session.json')) && !existsSync(helperDirectory));
assert(!readdirSync(tmpdir()).some(name => name.startsWith('sgm-local-runtime-')));
assert.throws(() => process.kill(Number(helperPid), 0), error => error.code === 'ESRCH');
const endpoints = await assertLocalEndpointsClosed([5001, 8080, 9000, 9099, 45690, 45691]);
const base = resolve(root, reviewPaginationFolder); assert(!existsSync(base), 'Never replace original evidence');
const json = file => JSON.parse(readFileSync(file));
const phone = json(resolve(trial, 'phone/session-results.json')), service = json(resolve(trial, 'services-second.json')),
  first = json(resolve(trial, 'services-first.json'));
assert(phone.completed && service.completed && !first.completed);
mkdirSync(base, {recursive: true});
const save = (name, value) => writeFileSync(resolve(base, name + '.json'), JSON.stringify(value, null, 2) + '\n', {flag: 'wx'});
cpSync(resolve(trial, 'phone'), resolve(base, 'phone'), {recursive: true});
cpSync(resolve(trial, 'captures'), resolve(base, 'captures'), {recursive: true});
cpSync(resolve(trial, 'ui-review.json'), resolve(base, 'ui-review.json'));
save('service', service); save('first-preparation', first);
for (const [from, to] of [['first-controller.mjs.txt', 'first-controller.mjs.txt'], ['backend-units.log', 'backend-units.txt'],
  ['android-phone-build.log', 'android-build.txt'], ['ios-model-state.log', 'ios-model-checks.txt']]) cpSync(resolve(trial, from), resolve(base, to));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const archive = resolve(root, 'docs/release/evidence/source-archive'); mkdirSync(archive, {recursive: true});
const retain = (file, expected, bytes) => {
  assert.equal(hash(bytes), expected, file);
  const path = resolve(archive, expected + '.txt'); if (!existsSync(path)) writeFileSync(path, bytes, {flag: 'wx'});
};
for (const report of [first, service, phone]) for (const [file, expected] of Object.entries(report.sourceFiles)) {
  const bytes = report === first && file === 'scripts/qa/local-review-pagination.mjs'
    ? readFileSync(resolve(base, 'first-controller.mjs.txt')) : readFileSync(resolve(root, file));
  retain(file, expected, bytes);
}
const nativeFiles = ['android/app/build.gradle.kts', ...['data/Models.kt', 'data/PendingReviewPage.kt', 'services/ProviderContracts.kt',
  'services/FirebaseAndroidGateway.kt', 'services/FirebaseAndroidInboxMappers.kt', 'services/PendingReviewGateway.kt',
  'services/FirebaseAndroidPendingReviewGateway.kt', 'ui/PendingReviewsState.kt', 'ui/MessagesInboxState.kt',
  'ui/MessagesInboxRoute.kt', 'ui/MessagesCards.kt', 'ui/MessagesNavigation.kt'].map(file => 'android/app/src/main/java/be/sportgreenmoove/app/' + file)];
const nativeSources = Object.fromEntries(nativeFiles.map(file => [file, hash(readFileSync(resolve(root, file)))]));
for (const [file, expected] of Object.entries(nativeSources)) retain(file, expected, readFileSync(resolve(root, file)));
save('native-sources', nativeSources);
const unitDirectory = resolve(root, 'android/app/build/test-results/testDebugUnitTest'), parser = new XMLParser({ignoreAttributes: false});
const units = {tests: 0, failures: 0, errors: 0, skipped: 0};
for (const file of readdirSync(unitDirectory).filter(name => name.endsWith('.xml'))) {
  const suite = parser.parse(readFileSync(resolve(unitDirectory, file), 'utf8')).testsuite;
  for (const key of Object.keys(units)) units[key] += Number(suite['@_' + key] ?? 0);
  if (/PendingReview(?:Parser|sState)Test/.test(file)) cpSync(resolve(unitDirectory, file), resolve(base, file));
}
save('android-unit-counts', units);
const config = readFileSync(resolve(root, 'android/app/build/generated/source/buildConfig/debug/be/sportgreenmoove/app/BuildConfig.java'), 'utf8');
assert.match(config, /SGM_USE_FIREBASE_EMULATOR = true/); assert.match(config, /SGM_FIREBASE_EMULATOR_HOST = "localhost"/);
save('summary', {scope: 'pending-review-pagination-on-one-isolated-physical-android-not-release', testedAt: phone.testedAt,
  physicalDeviceCount: 1, accountsTested: 2, sourceApkSha256: phone.sourceApkSha256,
  sourceBaselineCommit: '3641ea1add6196cd19742d94bb7c28cf16960d74', implementationWasUncommittedAtBuild: true,
  publicCaptureMethod: 'browser-session-window-not-native-export', publicCaptures: reviewPaginationPublicCaptures,
  original31RideGapFixedInIsolatedReplay: true, phoneRatingSubmissionsIndependentlyObserved: 2,
  installedBytesIndependentlyVerified: false, processRestartProven: false, productionDeployed: false, productionWrites: false,
  releaseComplete: false, videoAccepted: false, componentTestsExecutedLocally: false, iosUiExecuted: false,
  iosPhysicalPhoneTested: false, providerMapRequests: 0, realPaymentExercised: false});
save('disposal', {observedAt: new Date().toISOString(), observerExitCode: 0, runtimeExitCode: 130, helperExitCode: 130,
  privateSessionAbsent: true, helperDirectoryAbsent: true, helperProcessAbsent: true, noLocalRuntimeDirectories: true,
  ports: endpoints.ports.map(port => ({port, available: true}))});
const hashes = {}, walk = directory => {for (const entry of readdirSync(resolve(base, directory), {withFileTypes: true})) {
  const file = directory ? directory + '/' + entry.name : entry.name;
  if (entry.isDirectory()) walk(file); else hashes[file] = hash(readFileSync(resolve(base, file)));
}}; walk(''); save('artifact-sha256', hashes);
console.log(JSON.stringify(validateReviewPaginationEvidence(root)));

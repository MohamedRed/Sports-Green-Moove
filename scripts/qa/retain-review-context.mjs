import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {cpSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync} from 'node:fs';
import {isAbsolute, resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {XMLParser} from 'fast-xml-parser';
import {assertLocalEndpointsClosed} from './local-emulator-lifecycle.mjs';
import {reviewContextCaptures, reviewContextFolder, validateReviewContextEvidence} from './review-context-evidence.mjs';

const [trial] = process.argv.slice(2), root = resolve(import.meta.dirname, '../..');
assert(isAbsolute(trial ?? '')); assert(!readdirSync(tmpdir()).some(name => name.startsWith('sgm-local-runtime-')));
for (const pid of [46362, 46391]) assert.throws(() => process.kill(pid, 0), error => error.code === 'ESRCH');
const endpoints = await assertLocalEndpointsClosed([5001, 8080, 9000, 9099, 45690, 45691, 5582, 5037]);
const base = resolve(root, reviewContextFolder); assert(!existsSync(base), 'Never replace original evidence');
mkdirSync(base, {recursive: true});
const json = path => JSON.parse(readFileSync(path)), hash = bytes => createHash('sha256').update(bytes).digest('hex');
const save = (name, data) => writeFileSync(resolve(base, name + '.json'), JSON.stringify(data, null, 2) + '\n', {flag: 'wx'});
const copies = [['service-java21.json', 'service.json'], ['device-copy.json', 'device-copy.json'],
  ['service-first.log', 'preparation-first.txt'], ['services.log', 'preparation-second.txt'],
  ['android-context-test-build.log', 'compile-preparation.txt'], ['android-final-build.log', 'android-build.txt'],
  ['backend-units.log', 'backend-units.txt'], ['components-first.txt', 'components-first.txt'],
  ['components-final.txt', 'components-intermediate.txt'], ['components-verified.txt', 'components-verified.txt'],
  ['ios-verified-checks.log', 'ios-checks.txt'], ['ios-booking-recovery-verified.json', 'ios-booking-recovery.json'],
  ['ios-booking-wire-verified.json', 'ios-booking-wire.json']];
for (const [from, to] of copies) cpSync(resolve(trial, from), resolve(base, to));
for (const name of reviewContextCaptures) cpSync(resolve(trial, 'review-trip-context-' + name + '.png'), resolve(base, 'review-trip-context-' + name + '.png'));
const archive = resolve(root, 'docs/release/evidence/source-archive'), service = json(resolve(base, 'service.json'));
const retain = (file, expected) => {
  const bytes = readFileSync(resolve(root, file)), digest = hash(bytes); if (expected) assert.equal(digest, expected, file);
  const path = resolve(archive, digest + '.txt'); if (!existsSync(path)) writeFileSync(path, bytes, {flag: 'wx'});
  return digest;
};
for (const [file, expected] of Object.entries(service.sourceFiles)) retain(file, expected);
const android = 'android/app/src/', ios = 'ios/Sources/SportsGreenMooveApp/';
const files = ['main/java/be/sportgreenmoove/app/ui/ReviewCard.kt', 'main/java/be/sportgreenmoove/app/ui/MessagesCards.kt',
  'main/java/be/sportgreenmoove/app/data/Models.kt', 'main/java/be/sportgreenmoove/app/data/ReviewTripContext.kt',
  'main/java/be/sportgreenmoove/app/services/ReviewTripContextParser.kt', 'main/java/be/sportgreenmoove/app/services/FirebaseAndroidPendingReviewGateway.kt',
  'androidTest/java/be/sportgreenmoove/app/ui/ReviewTripContextFlowTest.kt'].map(file => android + file)
  .concat(['ReviewTripContext.swift', 'ReviewTripContextWire.swift', 'Models.swift', 'PendingReviewWire.swift', 'MessagesScreen.swift'].map(file => ios + file));
save('native-sources', Object.fromEntries(files.map(file => [file, retain(file)])));
for (const [file, expected] of Object.entries(json(resolve(base, 'ios-booking-recovery.json')).sourceSha256)) retain(file, expected);
const units = {tests: 0, failures: 0, errors: 0, skipped: 0}, parser = new XMLParser({ignoreAttributes: false});
const directory = resolve(root, 'android/app/build/test-results/testDebugUnitTest');
for (const file of readdirSync(directory).filter(name => name.endsWith('.xml'))) {
  const suite = parser.parse(readFileSync(resolve(directory, file), 'utf8')).testsuite;
  for (const key of Object.keys(units)) units[key] += Number(suite['@_' + key] ?? 0);
  if (/ReviewTripContextParserTest/.test(file)) cpSync(resolve(directory, file), resolve(base, file));
}
save('android-unit-counts', units);
save('summary', {scope: 'isolated-review-trip-context-services-and-native-components-not-end-to-end-phone', testedAt: new Date().toISOString(),
  baselineCommit: '7e0e22ed7b5c6b207085e942c47d3d3ad48a8d2f', implementationWasUncommittedAtBuild: true,
  nativeComponentCases: 9, newNativeComponentCases: 3, backendUnitCases: 538, syntheticContentOnly: true,
  physicalDeviceTested: false, nativeServiceIntegrationVerified: false, processRestartProven: false,
  realNetworkLossVerified: false, fullNativeGatePassedForThisImplementation: false, productionDeployed: false,
  productionWrites: false, realPayments: false, iosUiExecuted: false, releaseComplete: false, providerRequests: 0});
save('disposal', {observedAt: new Date().toISOString(), ownedEmulatorProcessAbsent: true, ownedAdbProcessAbsent: true,
  noLocalRuntimeDirectories: true, ports: endpoints.ports.map(port => ({port, available: true}))});
const hashes = {};
for (const file of readdirSync(base)) hashes[file] = hash(readFileSync(resolve(base, file)));
save('artifact-sha256', hashes); console.log(JSON.stringify(validateReviewContextEvidence(root)));

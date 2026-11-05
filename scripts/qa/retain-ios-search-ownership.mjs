import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {content} from '../../partner-portal/content.mjs';
const root = resolve(import.meta.dirname, '../..'), input = process.argv[2]; assert(input?.startsWith('/'));
const folder = resolve(root, 'docs/release/evidence/ios-search-ownership-2026-11-05');
mkdirSync(folder, {recursive: true}); assert(!existsSync(resolve(folder, 'summary.json')));
assert.equal(JSON.parse(readFileSync(resolve(folder, 'baseline.json'))).staleResponseRestorations, 22);
const sha = value => createHash('sha256').update(value).digest('hex'), json = value => JSON.stringify(value, null, 2) + '\n';
const records = [], files = [];
const record = (name, bytes) => {
  assert(!/Bearer\s+[\w.~+/-]+=*|AIza[\w-]{20,}|eyJ[\w-]+\.[\w-]+\.[\w-]*/.test(bytes.toString()));
  writeFileSync(resolve(folder, name), bytes, {flag: 'wx'}); records.push({file: name, sha256: sha(bytes)});
};
for (const [from, name, marker] of [
  ['sgm-search-ownership-native-final3-20261105.log', 'native-result.txt', 'SearchOwnershipChecks passed: 90'],
  ['sgm-search-ownership-signature-final2-20261105.log', 'signature-result.txt', 'not an SDK build or phone test'],
  ['sgm-search-ownership-ui-syntax-final-20261105.log', 'syntax-result.txt', ''],
  ['sgm-owned-places-runtime-final-20261105.log', 'adapter-result.txt', '15 actual address/approval'],
  ['sgm-search-booking-recovery-20261105.log', 'booking-recovery-result.txt', 'Booking recovery recover: 1 cases passed'],
]) {
  const bytes = readFileSync(resolve(input, from)); assert(bytes.toString().includes(marker)); assert(!/error:|Fatal error/.test(bytes.toString())); record(name, bytes);
}
const app = 'ios/Sources/SportsGreenMooveApp/', checks = 'ios/Tests/SportsGreenMooveNativeChecks/';
const paths = ['SearchActivityState', 'SearchFormState', 'SearchRequestState', 'SearchScreen', 'PlaceSearchWire',
  'FirebasePlacesGateway', 'FirebaseSearchGateway', 'FirebaseOwnedBookingGateway', 'FirebaseBookingRequests',
  'BookingRequestCoordinator', 'PendingBookingStore', 'AppState', 'AppState+Search', 'AppState+Bookings',
  'AccountWorkScope', 'GatewayContracts', 'UnconfiguredGateways', 'PublishController', 'PublishScreen',
  'UITestAppStateFactory', 'Models', 'FirebaseCallableBoundary', 'FirebaseNativeGateway', 'FirebaseBookingGateway'].map(name => app + name + '.swift');
paths.push(...['SearchOwnershipChecks', 'PlaceSearchWireChecks', 'SearchConsentChecks', 'SearchAppStateChecks', 'AppDataProbe', 'main'].map(name => checks + name + '.swift'));
for (const prefix of ['tests/fixtures/ios-search-callable/', 'tests/fixtures/ios-membership-fixture/'])
  paths.push(...readdirSync(resolve(root, prefix)).filter(name => name.endsWith('.swift')).map(name => prefix + name));
paths.push('tests/fixtures/ios-ride-chat-runtime/FirebaseAuth.swift',
  'ios/UITests/SportsGreenMooveUITests/OwnedSearchFlowChecks.swift', 'ios/UITests/SportsGreenMooveUITests/SearchConsentFlowTests.swift',
  'scripts/check-ios-native-plan.sh', 'scripts/check-ios-support-concurrency.sh', 'scripts/qa/check-ios-owned-places.sh',
  '.github/workflows/ios-mvp-verification.yml', '.github/workflows/web-integration-smoke.yml');
for (const path of paths) {
  const bytes = readFileSync(resolve(root, path)), hash = sha(bytes), archive = resolve(root, 'docs/release/evidence/source-archive', hash + '.txt');
  if (!existsSync(archive)) writeFileSync(archive, bytes, {flag: 'wx'});
  assert.equal(sha(readFileSync(archive)), hash); files.push({path, sha256: hash});
}
record('source-sha256.json', json({files}));
record('portal-before.json', json({flows: content.flows.map(row => ({id: row.id, sha256: sha(JSON.stringify(row))})),
  updates: content.updates.map(row => sha(JSON.stringify(row))), blockers: sha(JSON.stringify(content.blockers))}));
const linux = JSON.parse(readFileSync(resolve(input, 'sgm-rules-linux-ci-a188-20261105.json')));
assert.equal(linux.head, 'a188fcadfb236e4f3a0114ef8d11bdfe9e15e078');
const completed = linux.rules.flatMap(row => row.steps).find(step => step.name === 'Validate rules configuration without cloud changes');
assert.equal(completed.conclusion, 'success'); record('separate-linux-rules-validation.json', json(linux));
record('summary.json', json({checkedAt: '2026-11-05', scope: 'owned-iphone-search-local-not-sdk-ui-or-real-map-service',
  baselineRestorations: 22, baselineUnleasedCallbacks: 24, delayedCandidateCases: 90,
  malformedPlaceGroups: 21, scriptedAdapterCallbacks: 15, preCallSdkDenials: 4,
  exactTwoSeatChildBookingSelectionAndPayloadAccepted: true, retainedBookingRecoveryChecks: 14,
  originalFixtureCaseCount: 11, currentFixtureCaseCount: 11, deadlineMinutes: 50,
  currentSdkBuildAccepted: false, currentFixtureUiAccepted: false, nativeMapIntegrationAccepted: false,
  physicalDeviceAccepted: false, productionWrites: 0, providerRequests: 0, newPhoneSessions: 0, newMedia: 0,
  releaseComplete: false, records: [...records]}));
console.log('Retained the negative search baseline, 90 guarded callbacks, strict wire and scripted SDK checks without accepting native/map/physical completion.');

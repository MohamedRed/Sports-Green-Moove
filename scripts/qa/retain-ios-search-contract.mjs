import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {content} from '../../partner-portal/content.mjs';

const root = resolve(import.meta.dirname, '../..'), input = process.argv[2];
assert(input?.startsWith('/'), 'Specify the private result directory');
const directory = resolve(root, 'docs/release/evidence/ios-search-contract-2026-11-05');
mkdirSync(directory, {recursive: true}); assert(!existsSync(resolve(directory, 'summary.json')));
const baseCommit = 'cd76635276252e9feabf25e0cf8b90750728f6b8';
const json = value => JSON.stringify(value, null, 2) + '\n';
const sha = value => createHash('sha256').update(value).digest('hex');
const records = [];
function record(name, bytes) {
  assert(!/Bearer\s+[\w.~+/-]+=*|AIza[\w-]{20,}|eyJ[\w-]+\.[\w-]+\.[\w-]*/.test(bytes.toString()));
  writeFileSync(resolve(directory, name), bytes, {flag: 'wx'});
  records.push({file: name, sha256: sha(bytes)});
}
function archive(path, bytes, commit) {
  const hash = sha(bytes), file = resolve(root, 'docs/release/evidence/source-archive', hash + '.txt');
  if (!existsSync(file)) writeFileSync(file, bytes, {flag: 'wx'});
  assert.equal(sha(readFileSync(file)), hash); return {path, sha256: hash, ...(commit ? {commit} : {})};
}
for (const [name, source, marker] of [
  ['baseline-result.txt', 'sgm-ios-search-contract-baseline-pinned-20261105.log', '8/8 malformed results accepted'],
  ['contract-result.txt', 'sgm-ios-search-contract-final-20261105.log', '60 incomplete, contradictory or unsafe response groups'],
  ['native-result.txt', 'sgm-ios-search-contract-native-20261105.log', 'OwnedPlacesAdapterChecks passed'],
  ['signature-result.txt', 'sgm-ios-search-contract-signature-20261105.log', 'not an SDK build or phone test'],
]) {
  const bytes = readFileSync(resolve(input, source)); assert(bytes.toString().includes(marker));
  assert(!/error:|Fatal error/.test(bytes.toString())); record(name, bytes);
}
const paths = ['TripSearchWire.swift', 'EncodedRouteValidation.swift', 'FirebaseSearchGateway.swift', 'FirebaseMapMappers.swift',
  'Models.swift', 'BookingIntentSnapshot.swift', 'TeamChatModels.swift', 'TeamChatWire.swift'].map(name => 'ios/Sources/SportsGreenMooveApp/' + name);
paths.push('functions/src/lib/clientTrips.ts', 'functions/src/domain/bookingIntent.ts', 'functions/src/callables/trips.ts',
  'scripts/qa/check-ios-search-contract.mjs', 'scripts/qa/local-trip-input.mjs', 'scripts/qa/local-egress-guard.mjs',
  'tests/fixtures/ios-search-contract/main.swift', 'tests/fixtures/ios-search-contract/Mutations.swift',
  'tests/fixtures/ios-search-callable/FirebaseFunctions.swift', 'tests/fixtures/ios-ride-chat-runtime/FirebaseAuth.swift',
  'scripts/check-ios-native-plan.sh', 'scripts/check-ios-support-concurrency.sh',
  '.github/workflows/ios-mvp-verification.yml', '.github/workflows/web-integration-smoke.yml');
record('source-sha256.json', json({files: paths.map(path => archive(path, readFileSync(resolve(root, path))))}));
const baseline = ['FirebaseSearchGateway.swift', 'FirebaseMapMappers.swift'].map(name => {
  const path = 'ios/Sources/SportsGreenMooveApp/' + name;
  return archive(path, execFileSync('git', ['show', baseCommit + ':' + path], {cwd: root}), baseCommit);
});
record('baseline-source-sha256.json', json({files: baseline}));
record('portal-before.json', json({flows: content.flows.map(row => ({id: row.id, sha256: sha(JSON.stringify(row))})),
  updates: content.updates.map(row => sha(JSON.stringify(row))), blockers: sha(JSON.stringify(content.blockers))}));
record('service-attempt.json', json({result: 'not-executed', assertionGroupsCompleted: 0,
  reason: 'The configured Java 21 prerequisite was unavailable; the CLI stopped before service tests.',
  source: 'sgm-ios-search-contract-booking-service-20261105.log', countedAsServiceEvidence: false}));
record('summary.json', json({checkedAt: '2026-11-05', baseCommit, scope: 'controlled-server-serializer-and-actual-swift-gateway-not-live-service-or-phone',
  baselineMalformedGroupsAccepted: 8, validServerSummaries: 3, malformedResponseGroupsRejected: 60,
  directNonfiniteScoresRejected: 3, delayedSdkBoundaryCases: 4, preCallIdentityDenials: 1,
  secondChildTwoSeatPayloadAndSnapshotChecked: true, originalUiCaseCount: 11, currentUiCaseCount: 11,
  deadlineMinutes: 50, sdkBuildAccepted: false, fixtureUiAccepted: false, liveServiceAccepted: false,
  linuxContractExecutionAccepted: false, realMapIntegrationAccepted: false, completeBookingFlowAccepted: false,
  physicalDeviceAccepted: false, productionWrites: 0, providerRequests: 0, newPhoneSessions: 0, newMedia: 0,
  releaseComplete: false, records: [...records]}));
console.log('Retained the actual serializer/Swift contract and pinned negative baseline without accepting live booking or native release completion.');

import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import test from 'node:test';
import {parseDocument} from 'yaml';
import {content} from '../partner-portal/content.mjs';
import {iosSearchContract, iosSearchContractProgress} from '../partner-portal/ios-search-contract.mjs';
import {partitionUpdates} from '../partner-portal/src/render.js';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const json = path => JSON.parse(read(path)), sha = value => createHash('sha256').update(value).digest('hex');
const folder = 'docs/release/evidence/ios-search-contract-2026-11-05/', app = 'ios/Sources/SportsGreenMooveApp/';
const report = json(iosSearchContract.source);

test('the pinned negative search gateway accepts eight malformed replies without turning that result into acceptance', () => {
  assert.equal(report.baseCommit, 'cd76635276252e9feabf25e0cf8b90750728f6b8');
  assert.equal(report.baselineMalformedGroupsAccepted, 8);
  assert(read(folder + 'baseline-result.txt').includes('8/8 malformed results accepted'));
  assert(read(folder + 'baseline-result.txt').includes('not accepted'));
  for (const row of json(folder + 'baseline-source-sha256.json').files) {
    assert.equal(row.commit, report.baseCommit);
    assert.equal(sha(read('docs/release/evidence/source-archive/' + row.sha256 + '.txt')), row.sha256);
  }
  const row = json(folder + 'baseline-source-sha256.json').files.find(row => row.path.endsWith('FirebaseSearchGateway.swift'));
  assert(read('docs/release/evidence/source-archive/' + row.sha256 + '.txt').includes('data["priceLabel"] as? String ?? "Gratuit"'));
});

test('the current decoder requires complete atomic results and consistent displayed booking terms without guessed defaults', () => {
  const wire = read(app + 'TripSearchWire.swift'), gateway = read(app + 'FirebaseSearchGateway.swift');
  for (const text of ['rows.count <= 12', 'try rows.map', 'Set(matches.map(\\.tripId))',
    'BookingIntentSnapshot.fromPayload(intentData)', 'seatsNeeded <= intent.context.seatsTotal',
    'priceLabel == price(intent.terms.priceCents)', 'range: seatsNeeded...intent.context.seatsTotal',
    'CFGetTypeID(value) != CFBooleanGetTypeID()', 'value.doubleValue.isFinite', 'value.rounded(.towardZero) == value',
    'start == intent.terms.origin, end == intent.terms.destination', 'finalEncoded == nil || finalEncoded == encoded']) assert(wire.includes(text), text);
  assert(gateway.includes('TripSearchWire.matches(result?.data as Any, seatsNeeded: criteria.seatsNeeded)'));
  assert.equal((gateway.match(/Auth.auth\(\).currentUser\?\.uid == criteria.requesterUserId/g) ?? []).length, 2);
  assert.doesNotMatch(gateway + wire, /compactMap|mapClientTripSummary|mapTripMatch|\?\? "Gratuit"|\?\? "Trajet sportif"|@preconcurrency|nonisolated\(unsafe\)/);
  assert.doesNotMatch(read(app + 'FirebaseMapMappers.swift'), /mapRoutePreviewFromMatchData|private func mapRoutePreview\(/);
  const route = read(app + 'EncodedRouteValidation.swift');
  for (const text of ['bytes.count <= 200_000', 'points >= 2', 'through: 30', '(63...126).contains(bytes[index])',
    '(-9_000_000...9_000_000).contains(latitude)', '(-18_000_000...18_000_000).contains(longitude)']) assert(route.includes(text));
});

test('executed actual serializer and gateway checks retain exact second-child two-seat data and sixty rejected groups', () => {
  for (const row of report.records) assert.equal(sha(read(folder + row.file)), row.sha256, row.file);
  for (const row of json(iosSearchContract.checksums).files) {
    assert.equal(sha(read('docs/release/evidence/source-archive/' + row.sha256 + '.txt')), row.sha256, row.path);
    if (row.path.endsWith('.swift')) assert(read(row.path).split('\n').length < 300, row.path);
  }
  const result = read(folder + 'contract-result.txt');
  assert(result.includes('three actual server summaries retain exact labels, route endpoints and booking snapshot'));
  assert(result.includes('60 incomplete, contradictory or unsafe response groups'));
  assert(result.includes('four delayed SDK error/identity/cancellation cases and one pre-call denial'));
  assert.equal(report.validServerSummaries, 3); assert.equal(report.malformedResponseGroupsRejected, 60);
  assert.equal(report.directNonfiniteScoresRejected, 3); assert.equal(report.secondChildTwoSeatPayloadAndSnapshotChecked, true);
  assert(read(folder + 'native-result.txt').includes('SearchOwnershipChecks passed: 90'));
  assert(read(folder + 'native-result.txt').includes('Publication ownership checks passed: 42'));
  assert(read(folder + 'native-result.txt').includes('SportsGreenMooveNativeChecks passed'));
});

test('the runner executes real production sources with scripted SDK transport and explicit portable library paths', () => {
  const runner = read('scripts/qa/check-ios-search-contract.mjs');
  for (const text of ["import './local-egress-guard.mjs'", "'../../functions/lib/lib/clientTrips.js'", 'toClientTripSummary(trip)',
    "'FirebaseSearchGateway.swift'", "'TripSearchWire.swift'", "'EncodedRouteValidation.swift'", "'dylib' : 'so'",
    "'DYLD_LIBRARY_PATH' : 'LD_LIBRARY_PATH'", 'timeout: 120_000', 'finally { rmSync(build', "baseline ? 'baseline' : 'verify'"]) assert(runner.includes(text));
  assert.doesNotMatch(runner, /firebase emulators|curl|fetch\(|retry|continue-on-error|only-testing|upload-artifact/);
  assert(runner.includes("'TeamChatText.swift'")); assert.doesNotMatch(runner, /TeamChatModels\.swift|TeamChatWire\.swift|CryptoKit/);
  const oldModels = json(iosSearchContract.checksums).files.find(row => row.path.endsWith('/TeamChatModels.swift'));
  const original = read('docs/release/evidence/source-archive/' + oldModels.sha256 + '.txt');
  const extracted = read(app + 'TeamChatText.swift');
  assert.equal(extracted.slice(extracted.indexOf('enum TeamChatText')).trim(), original.slice(original.indexOf('enum TeamChatText')).trim());
  assert.doesNotMatch(read(app + 'TeamChatModels.swift'), /enum TeamChatText/);
  const portability = 'docs/release/evidence/ios-search-contract-portability-2026-11-05/';
  const correction = json(portability + 'summary.json'), failure = json(portability + 'linux-failure.json');
  assert.equal(failure.runId, 42080158221); assert.equal(failure.jobId, 127430792792);
  assert.equal(failure.conclusion, 'failure'); assert.equal(failure.compilationStoppedBeforeContractCases, true);
  assert(failure.selectedError.includes("no such module 'CryptoKit'"));
  for (const row of correction.records) assert.equal(sha(read(portability + row.file)), row.sha256);
  for (const row of json(portability + 'source-sha256.json').files) assert.equal(sha(read('docs/release/evidence/source-archive/' + row.sha256 + '.txt')), row.sha256);
  assert.equal(correction.normalizationImplementationUnchanged, true); assert.equal(correction.chatCryptoImplementationUnchanged, true);
  assert.equal(correction.localContractPassed, true); assert.equal(correction.linuxExecutionAccepted, false);
  for (const path of ['scripts/check-ios-native-plan.sh', 'scripts/check-ios-support-concurrency.sh',
    'scripts/qa/check-ios-owned-places.sh', 'scripts/qa/check-ios-ride-chat-runtime.sh']) assert(read(path).includes('TeamChatText.swift'));
  const fixture = read('tests/fixtures/ios-search-contract/main.swift');
  for (const text of ['gateway.searchTripMatches(criteria: criteria)', 'bookingRequestPayload(trip: match.summary',
    '"isolated-child-2"', 'childId: criteria.childUserId, seats: criteria.seatsNeeded)', 'request["seats"] as? Int == 2',
    'NSDictionary(dictionary: payload).isEqual(to: expected)', 'Auth.auth().setUser("other")', 'sdk.count == before', 'sdk.pending == 0']) {
    assert(fixture.includes(text), text);
  }
});

test('the additional smoke executes after backend compilation while eleven iPhone cases and all approved resource bounds stay intact', () => {
  const web = parseDocument(read('.github/workflows/web-integration-smoke.yml')).toJSON();
  for (const event of ['push', 'pull_request']) for (const path of ['scripts/qa/check-ios-search-contract.mjs', 'tests/fixtures/ios-search-contract/**', 'tests/ios-search-contract.test.mjs']) assert(web.on[event].paths.includes(path));
  const steps = web.jobs.smoke.steps, index = steps.findIndex(row => row.name === 'Verify iPhone search-to-booking contract without provider calls');
  assert(index > steps.findIndex(row => row.run === 'npm run build --workspace functions'));
  assert.equal(steps[index].run, 'node scripts/qa/check-ios-search-contract.mjs && node --test tests/ios-search-contract.test.mjs');
  const workflow = parseDocument(read('.github/workflows/ios-mvp-verification.yml')).toJSON();
  assert(workflow.on.pull_request.paths.includes('tests/ios-search-contract.test.mjs'));
  const job = workflow.jobs['ios-fixture-verification']; assert.equal(job['timeout-minutes'], 50);
  const uploads = job.steps.filter(row => row.uses?.startsWith('actions/upload-artifact')); assert.equal(uploads.length, 1);
  assert.equal(uploads[0].with['retention-days'], 1);
  const dir = 'ios/UITests/SportsGreenMooveUITests/';
  const count = readdirSync(new URL('../' + dir, import.meta.url)).filter(name => name.endsWith('.swift'))
    .flatMap(name => [...read(dir + name).matchAll(/func test\w+\(/g)]).length;
  assert.equal(count, 11);
  for (const name of ['TripSearchWire.swift', 'EncodedRouteValidation.swift']) assert(read('scripts/check-ios-support-concurrency.sh').includes(name));
});

test('the concise current note preserves historical content and never promotes the unexecuted service or current native release', () => {
  assert.deepEqual(content.iosSearchContract, iosSearchContract);
  assert.deepEqual(content.updates.filter(row => row.source === iosSearchContractProgress.source), [iosSearchContractProgress]);
  assert(partitionUpdates(content.updates).recent.some(row => row.source === iosSearchContractProgress.source));
  assert.doesNotMatch(iosSearchContractProgress.title + iosSearchContractProgress.text, /Firebase|BrowserStack|Swift|SDK|Xcode|CI\b/i);
  const before = json(folder + 'portal-before.json');
  for (const row of before.flows) assert.equal(sha(JSON.stringify(content.flows.find(flow => flow.id === row.id))), row.sha256);
  for (const hash of before.updates) assert(content.updates.some(row => sha(JSON.stringify(row)) === hash));
  assert.equal(sha(JSON.stringify(content.blockers)), before.blockers);
  const attempt = json(folder + 'service-attempt.json');
  assert.equal(attempt.result, 'not-executed'); assert.equal(attempt.assertionGroupsCompleted, 0);
  assert.equal(attempt.countedAsServiceEvidence, false);
  for (const key of ['sdkBuildAccepted', 'fixtureUiAccepted', 'liveServiceAccepted', 'linuxContractExecutionAccepted',
    'realMapIntegrationAccepted', 'completeBookingFlowAccepted', 'physicalDeviceAccepted', 'releaseComplete']) assert.equal(report[key], false);
  for (const key of ['productionWrites', 'providerRequests', 'newPhoneSessions', 'newMedia']) assert.equal(report[key], 0);
  const manifest = json('docs/release/evidence-manifest.json');
  for (const id of ['ios_sdk_build_ci', 'ios_fixture_ui_ci']) assert.equal(manifest.automatedUserFlowEvidence.items.find(row => row.id === id).status, 'pending');
});

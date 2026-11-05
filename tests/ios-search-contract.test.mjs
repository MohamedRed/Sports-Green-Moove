import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import test from 'node:test';
import {parseDocument} from 'yaml';
import {content} from '../partner-portal/content.mjs';
import {iosSearchContract, iosSearchContractProgress} from '../partner-portal/ios-search-contract.mjs';
import {partitionUpdates} from '../partner-portal/src/render.js';
import {verificationBoundaries, verificationBoundariesProgress} from '../partner-portal/verification-boundaries.mjs';
import {verificationFollowup, verificationFollowupProgress} from '../partner-portal/verification-followup.mjs';

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
    'request.1 == expectedBytes', 'Auth.auth().setUser("other")', 'sdk.count == before', 'sdk.pending == 0']) {
    assert(fixture.includes(text), text);
  }
  assert(fixture.includes('JSONSerialization.data(withJSONObject: input, options: .sortedKeys)'));
  assert(fixture.includes('"guardianConsent": 1')); assert(fixture.includes('"extra": "rejected"'));
  assert.doesNotMatch(fixture, /NSDictionary/);
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
  assert(partitionUpdates(content.updates).previous.some(row => row.source === iosSearchContractProgress.source));
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

test('later failed gates retain exact sources, cleanup and unknown causes instead of accepting local candidates', () => {
  const dir = 'docs/release/evidence/verification-boundaries-2026-11-05/';
  const summary = json(verificationBoundaries.source);
  for (const row of summary.records) assert.equal(sha(read(dir + row.file)), row.sha256, row.file);
  for (const row of json(dir + 'source-sha256.json').files)
    assert.equal(sha(read('docs/release/evidence/source-archive/' + row.sha256 + '.txt')), row.sha256);
  const linux = json(dir + 'linux-job.json'), android = json(dir + 'android-job.json'), iphone = json(dir + 'iphone-job.json');
  assert.equal(linux.runId, 42085479173); assert.equal(android.runId, 42085479235); assert.equal(iphone.runId, 42080157901);
  assert.equal(linux.sourceCommit, '584c61b61453878e1bd2631b48ca2fef5e9de4d4');
  assert.equal(android.sourceCommit, linux.sourceCommit);
  assert.equal(iphone.sourceCommit, '9ae6ea709da5f487a51a1542864d4cf4d0e8f4b1');
  assert.equal(linux.conclusion, 'failure'); assert.equal(linux.compilationCompleted, true);
  assert.equal(linux.requestComparisonFailed, true); assert.equal(linux.responseGroupsExecuted, false);
  assert.equal(linux.payloadEquivalenceEstablishedOnLinux, false); assert.equal(linux.rootCauseConfirmed, false);
  assert.equal(android.conclusion, 'failure'); assert.equal(android.appFlowExecuted, false);
  assert.equal(android.nondefaultWifiValidationKnown, false); assert.equal(android.rootCauseConfirmed, false);
  const outcome = json(dir + 'android-outcome.json'), sample = json(dir + 'android-last-sample.json');
  assert.equal(outcome.sampleCount, 59); assert.equal(outcome.budgetMs, 180000); assert.equal(outcome.intervalMs, 3000);
  assert.equal(outcome.testAppsAbsent, true); assert.equal(outcome.failureKind, 'wifi-prerequisite-deadline');
  for (const key of ['ready', 'completed', 'flowCompleted', 'settingsChanged', 'radioChanged', 'newProbesIssued'])
    assert.equal(outcome[key], false);
  assert.deepEqual(sample.active.transports, ['cellular']); assert.equal(sample.active.validated, true);
  assert.equal(sample.wifiAvailable, true); assert.equal(Object.hasOwn(sample, 'availableCapabilities'), false);
  assert.equal(iphone.conclusion, 'cancelled');
  assert.equal(iphone.steps.find(row => row.name === 'Compile app and all fixture test bundles').conclusion, 'cancelled');
  assert.equal(iphone.steps.find(row => row.name === 'Run every built fixture test without rebuilding').conclusion, 'skipped');
  assert.equal(iphone.steps.find(row => row.name === 'Dispose isolated simulator').conclusion, 'success');
  assert(json(dir + 'iphone-annotations.json').some(row => row.message.includes('50m0s')));
  assert.equal(json(dir + 'iphone-artifacts.json').total_count, 0);
  assert.equal(summary.candidate.runner, 'macos-26'); assert.equal(summary.candidate.fixtureCases, 11);
  assert.equal(summary.candidate.timeoutMinutes, 50); assert.equal(summary.candidate.performanceImprovementProven, false);
  for (const key of ['captureLimitChanged', 'readinessPredicateChanged', 'readinessBudgetChanged']) assert.equal(summary.candidate[key], false);
  assert.equal(summary.localExactRequestAndResponseContractPassed, true);
  for (const key of ['linuxExecutionAccepted', 'sdkBuildAccepted', 'fixtureUiAccepted', 'physicalDeviceAccepted', 'releaseComplete'])
    assert.equal(summary[key], false);
  assert(read(dir + 'local-contract.txt').includes('boolean/number substitution and missing/extra fields rejected'));
});

test('one concise incomplete-test note preserves every historical flow, update, blocker and media reference', () => {
  assert.deepEqual(content.verificationBoundaries, verificationBoundaries);
  assert.deepEqual(content.updates.filter(row => row.source === verificationBoundariesProgress.source), [verificationBoundariesProgress]);
  assert(partitionUpdates(content.updates).recent.some(row => row.source === verificationBoundariesProgress.source));
  assert.doesNotMatch(verificationBoundariesProgress.title + verificationBoundariesProgress.text,
    /Firebase|BrowserStack|Android|Swift|SDK|Xcode|CI\b|macos|runner/i);
  const before = json('docs/release/evidence/verification-boundaries-2026-11-05/portal-before.json');
  for (const row of before.flows) assert.equal(sha(JSON.stringify(content.flows.find(flow => flow.id === row.id))), row.sha256);
  for (const hash of before.updates) assert(content.updates.some(row => sha(JSON.stringify(row)) === hash));
  assert.equal(sha(JSON.stringify(content.blockers)), before.blockers);
});

test('the actual aac Linux contract step passes without accepting the whole workflow, native screens or missing iPhone push wiring', () => {
  const dir = 'docs/release/evidence/verification-followup-aac-2026-11-05/';
  const step = json(dir + 'linux-contract-step.json'), summary = json(dir + 'summary.json');
  assert.equal(step.runId, 42091345475); assert.equal(step.jobId, 127469877249);
  assert.equal(step.sourceCommit, 'aac8de64f2da97b638079103a77a02d2b367d83f');
  assert.equal(step.status, 'completed'); assert.equal(step.conclusion, 'success');
  assert.equal(summary.linuxControlledContractStepAccepted, true);
  for (const key of ['wholeWorkflowAcceptedByThisRecord', 'nativeSdkAccepted', 'phoneAccepted']) assert.equal(step[key], false);
  const files = json(dir + 'source-sha256.json').files;
  const frozen = path => read('docs/release/evidence/source-archive/' + files.find(row => row.path === path && row.commit === step.sourceCommit).sha256 + '.txt');
  assert.doesNotMatch(frozen('ios/project.yml'), /FirebaseMessaging/);
  assert(frozen('functions/src/domain/teamPushRegistration.ts').includes('platform: z.literal("android")'));
  assert.doesNotMatch(frozen('functions/src/services/teamPushProvider.ts'), /apns:/);
  assert.equal(summary.iphoneClosedAppNotificationsImplemented, false); assert.equal(summary.notificationPolicyChanged, false);
  for (const key of ['sdkBuildAccepted', 'fixtureUiAccepted', 'physicalDeviceAccepted', 'releaseComplete']) assert.equal(summary[key], false);
  assert.deepEqual(content.verificationFollowup, verificationFollowup);
  assert.deepEqual(content.updates.filter(row => row.source === verificationFollowupProgress.source), [verificationFollowupProgress]);
  assert(partitionUpdates(content.updates).recent.some(row => row.source === verificationFollowupProgress.source));
  assert.doesNotMatch(verificationFollowupProgress.title + verificationFollowupProgress.text,
    /Firebase|BrowserStack|Android|Linux|Swift|SDK|Xcode|CI\b|DNS/i);
});

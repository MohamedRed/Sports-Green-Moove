import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {test} from 'node:test';
import {parseDocument} from 'yaml';
import {content} from '../partner-portal/content.mjs';
import {iosReceivedRatings, iosReceivedRatingsProgress} from '../partner-portal/ios-received-ratings.mjs';
import {partitionUpdates} from '../partner-portal/src/render.js';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const app = 'ios/Sources/SportsGreenMooveApp/';
const folder = 'docs/release/evidence/ios-received-ratings-2026-11-05/';

test('the iPhone profile now owns and displays the actual received average and count without fabricating a score', () => {
  const profile = read(app + 'ProfileScreen.swift');
  assert(profile.includes('ProfileReceivedRatings(access: access, gateway: appState.firebase).id(access.context.id)'));
  const view = read(app + 'ProfileReceivedRatings.swift');
  for (const part of ['if state.live', 'if state.busy', 'if let summary = state.summary', 'if let average = summary.average',
    'Aucun avis reçu', 'summary.count.formatted()', 'profile.rating.average', 'profile.rating.count', 'state.refresh()',
    'state.resume()', 'state.suspend()', 'state.close()', '.fixedSize(horizontal: false, vertical: true)']) assert(view.includes(part));
  assert.doesNotMatch(view, /\?\? 0|\?\? 5|localizedDescription|error\.description|BrowserStack|Firebase/);
  assert(read(app + 'GatewayContracts.swift').includes('ReceivedRatingsGateway'));
  const report = JSON.parse(read(iosReceivedRatings.source));
  const baseline = read('docs/release/evidence/source-archive/' + report.baselineProfileSha256 + '.txt');
  assert.equal(sha(baseline), report.baselineProfileSha256);
  assert.doesNotMatch(baseline, /ProfileReceivedRatings|rating\.average|rating\.count/);
});

test('received-rating requests bind the UID on both sides of the SDK transfer and never request raw reviews or another account', () => {
  const source = read(app + 'FirebaseReceivedRatingsGateway.swift').split('extension UnconfiguredFirebaseGateway')[0];
  assert.equal((source.match(/Auth.auth\(\).currentUser\?\.uid == uid/g) ?? []).length, 2);
  assert.equal((source.match(/try Task.checkCancellation\(\)/g) ?? []).length, 2);
  assert(source.indexOf('let input: [String: String] = [:]') > source.indexOf('withCheckedThrowingContinuation'));
  assert(source.includes('httpsCallable("getReceivedRatingSummary").call(input)'));
  assert(source.includes('ReceivedRatingsWire.parse(result?.data, uid: uid)'));
  assert.doesNotMatch(source, /collection\(|comment|ratings\?|@unchecked|@preconcurrency|Task.sleep|fallback|print\(|NSLog/);
  const wire = read(app + 'ReceivedRatings.swift');
  assert.equal((wire.match(/CFBooleanGetTypeID\(\)/g) ?? []).length, 2);
  for (const part of ['userId == uid', 'number.isFinite', 'number.rounded() == number', '9_007_199_254_740_991',
    'average == nil', 'average.isFinite', '(1...5).contains(average)', 'try result.validate(uid: uid)']) assert(wire.includes(part));
});

test('profile rating refresh uses immutable account generations, scrubs private state and drains actual callbacks', () => {
  const source = read(app + 'ReceivedRatingsState.swift');
  for (const part of ['access.begin()', 'access.finish(work)', 'access.owns(work)', 'generation == ticket',
    'gateway.receivedRatings(uid: access.context.uid)', 'try result.validate(uid: access.context.uid)',
    'summary = nil', 'error = nil', 'inFlight += 1', 'inFlight -= 1', 'access.waitingForEarlierWork']) assert(source.includes(part));
  assert.doesNotMatch(source, /inFlight = 0[^\n]*[;}].*func clear|Task.sleep|while |repeat |UserDefaults|print\(|NSLog/);
  const checks = read('ios/Tests/SportsGreenMooveNativeChecks/ReceivedRatingsChecks.swift');
  for (const part of ['same-uid', 'other-uid', 'role-roundtrip', 'roles-revoked', 'background', 'cancel',
    'fresh.begin() == nil', 'calls == ["parent"]', 'state.summary == nil && state.error == nil']) assert(checks.includes(part));
  assert(read('scripts/check-ios-native-plan.sh').includes('ReceivedRatingsChecks.swift'));
  assert(read('scripts/check-ios-support-concurrency.sh').includes('FirebaseReceivedRatingsGateway.swift'));
});

test('executed wire/lifecycle checks and authenticated 104/105-review service recheck retain exact evidence and distinct scopes', () => {
  const report = JSON.parse(read(iosReceivedRatings.source));
  assert.equal(report.checkedAt, '2026-11-05');
  assert.equal(report.baselineCommit, '91e08cbf73c339b231537e3e61199a287e48a9a4');
  assert.deepEqual(report.localChecks, {nativePlanExitCode: 0, signatureExitCode: 0, uiSyntaxExitCode: 0,
    validAggregates: 3, malformedAggregateGroups: 20, invalidEnvelopes: 3, delayedBoundaries: 16});
  for (const record of report.records) assert.equal(sha(read(folder + record.file)), record.sha256);
  const native = read(folder + 'native-result.txt');
  assert.match(native, /ReceivedRatingsWireChecks passed: 3 valid aggregates, 20 malformed\/foreign aggregate groups/);
  assert.match(native, /ReceivedRatingsStateChecks passed:.*16 delayed success\/error/);
  assert.match(native, /SportsGreenMooveNativeChecks passed/);
  const service = JSON.parse(read(folder + 'services.json'));
  assert.equal(service.completed, true); assert.equal(service.checks.length, 8);
  assert(service.checks.every(row => row.status === 'passed'));
  assert.equal(service.observations.find(row => row.phase === '104-received').result.count, 104);
  assert.equal(service.observations.find(row => row.phase === '104-received').result.average, 358 / 104);
  assert.equal(service.observations.find(row => row.phase === '105-received').result.average, 363 / 105);
  assert.equal(service.protectedRecordCount, 158); assert.equal(service.adminClientClosed, true);
  assert.equal(service.firestoreClientTerminated, true); assert.equal(service.isolatedEnvironmentDestroyed, true);
  assert.equal(service.emulatorEndpoints.closed, true); assert.equal(service.productionWrites, false);
  assert.equal(service.providerRequests, 0); assert.equal(service.phoneUiExecuted, false);
  for (const key of ['sdkLinkedBuildAccepted', 'fixtureUiExecuted', 'nativeServiceIntegrationAccepted', 'fullRatingFlowAccepted',
    'physicalDeviceAccepted', 'newNativeMediaPublished', 'releaseComplete']) assert.equal(report[key], false);
  for (const key of ['providerRequests', 'productionWrites', 'realPayments', 'newPhoneSessions']) assert.equal(report[key], 0);
  for (const file of JSON.parse(read(iosReceivedRatings.checksums)).files)
    assert.equal(sha(read('docs/release/evidence/source-archive/' + file.sha256 + '.txt')), file.sha256, file.path);
});

test('the prepared profile assertions keep all eleven UI cases, captures and the approved deadline', () => {
  const path = 'ios/UITests/SportsGreenMooveUITests/';
  const cases = readdirSync(new URL('../' + path, import.meta.url)).filter(file => file.endsWith('.swift'))
    .flatMap(file => [...read(path + file).matchAll(/func (test\w+)\(/g)].map(match => match[1]));
  assert.equal(cases.length, 11); assert.equal(new Set(cases).size, 11);
  const fixture = read(path + 'SportsGreenMooveUITests.swift');
  for (const part of ['profile.rating.count', '2 avis reçus', 'profile.rating.average', 'refreshRatings.tap()']) assert(fixture.includes(part));
  const gateway = read(app + 'FirebaseReceivedRatingsGateway.swift');
  assert(gateway.includes('#if DEBUG\nextension UITestFirebaseGateway'));
  assert(gateway.includes('throw ProviderConfigurationError'));
  const job = parseDocument(read('.github/workflows/ios-mvp-verification.yml')).toJSON().jobs['ios-fixture-verification'];
  assert.equal(job['timeout-minutes'], 50);
  const upload = job.steps.filter(step => step.uses?.startsWith('actions/upload-artifact'));
  assert.equal(upload.length, 1); assert.equal(upload[0].with['retention-days'], 1);
});

test('the concise local-only portal note has web and iPhone gate coverage without accepting release evidence', () => {
  assert.deepEqual(content.iosReceivedRatings, iosReceivedRatings);
  assert.deepEqual(content.updates.filter(row => row.source === iosReceivedRatingsProgress.source), [iosReceivedRatingsProgress]);
  assert(partitionUpdates(content.updates).recent.some(row => row.source === iosReceivedRatingsProgress.source));
  assert.doesNotMatch(iosReceivedRatingsProgress.title + iosReceivedRatingsProgress.text, /Firebase|BrowserStack|SDK|Swift|CI\b/i);
  const file = 'tests/ios-received-ratings.test.mjs';
  const web = parseDocument(read('.github/workflows/web-integration-smoke.yml')).toJSON();
  for (const event of ['pull_request', 'push']) assert(web.on[event].paths.includes(file));
  assert(Object.values(web.jobs).some(job => job.steps.some(step => step.run?.includes(file))));
  assert(parseDocument(read('.github/workflows/ios-mvp-verification.yml')).toJSON().on.pull_request.paths.includes(file));
  const manifest = JSON.parse(read('docs/release/evidence-manifest.json'));
  for (const id of ['ios_sdk_build_ci', 'ios_fixture_ui_ci']) assert.equal(manifest.automatedUserFlowEvidence.items.find(row => row.id === id).status, 'pending');
});

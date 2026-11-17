import test from 'node:test';
import assert from 'node:assert/strict';
import {assertCurrentIosAutomatedEvidence} from '../scripts/qa/ios-fixture-release-evidence.mjs';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {parseDocument} from 'yaml';
import {content} from '../partner-portal/content.mjs';
import {iosCurrentFixtureFailure, iosCurrentFixtureFailureProgress} from '../partner-portal/ios-current-fixture-failure.mjs';
import {ios584FixtureResult, ios584FixtureResultProgress} from '../partner-portal/ios-584-fixture-result.mjs';
import {ios6e89FixtureResult, ios6e89FixtureResultProgress} from '../partner-portal/ios-6e89-fixture-result.mjs';
import {partitionUpdates} from '../partner-portal/src/render.js';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const json = path => JSON.parse(read(path));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const folder = 'docs/release/evidence/ios-fixture-failure-d51-2026-11-05/';
const report = json(iosCurrentFixtureFailure.source);
test('EEF partial cancellation and D51 full failure retain original source and terminal outcomes', () => {
  for (const row of report.records) assert.equal(sha(read(folder + row.file)), row.sha256);
  for (const row of json(iosCurrentFixtureFailure.checksums).files)
    assert.equal(sha(readFileSync(new URL('../docs/release/evidence/source-archive/' + row.sha256 + '.txt', import.meta.url))), row.sha256);
  const [eef, d51] = report.outcomes;
  assert.equal(eef.conclusion, 'cancelled'); assert.equal(eef.fixtureCasesCompleted, 1); assert.equal(eef.passedCases, 1);
  assert.equal(d51.conclusion, 'failure'); assert.equal(d51.fixtureCasesCompleted, 11); assert.equal(d51.passedCases, 8); assert.equal(d51.failedCases, 3);
  for (const row of report.outcomes) {assert.equal(row.sdkBuild, 'success'); assert.equal(row.disposal, 'success'); assert.equal(row.artifactCount, 0);}
  const cases = json(folder + 'd51-cases.json');
  assert.deepEqual(cases.filter(row => row.status === 'failed').map(row => row.name), [
    'testAuthFlowIdentifiers', 'testMessagesChatAndRatingIdentifiers', 'testSecondaryFlowIdentifiers']);
  const text = read(folder + 'd51-selected-tests.txt');
  assert.equal((text.match(/: error:/g) ?? []).length, 5);
  assert(text.includes('Missing profile city entry')); assert(text.includes('Message de test iso'));
  assert(text.includes('membership.approve.ui-parent_club-tennis'));
});
test('eleven cases, unchanged approved deadline, empty artifacts and unaccepted release remain distinct', () => {
  assert.equal(report.deadlineMinutes, 50); assert.equal(report.plannedCases, 11); assert.equal(report.newMedia, 0);
  for (const key of ['fullFixtureGateAccepted', 'nativeServiceIntegrationAccepted', 'physicalDeviceAccepted', 'releaseComplete']) assert.equal(report[key], false);
  const workflow = parseDocument(read('.github/workflows/ios-mvp-verification.yml')).toJSON();
  assert.equal(workflow.jobs['ios-fixture-verification']['timeout-minutes'], 50);
  for (const name of ['eef', 'd51']) {
    assert.equal(json(folder + name + '-artifacts.json').total_count, 0);
    const run = json(folder + name + '-run.json'); assert.equal(run.status, 'completed');
    for (const step of ['Validate and collect only three approved synthetic captures', 'Retain approved iPhone captures for one day'])
      assert.equal(run.jobs[0].steps.find(row => row.name === step).conclusion, 'skipped');
  }
  assertCurrentIosAutomatedEvidence();
});
test('one short public result preserves historical notes and does not introduce provider names or media', () => {
  assert.deepEqual(content.iosCurrentFixtureFailure, iosCurrentFixtureFailure);
  assert.deepEqual(content.updates.filter(row => row.source === iosCurrentFixtureFailureProgress.source), [iosCurrentFixtureFailureProgress]);
  assert.doesNotMatch(iosCurrentFixtureFailureProgress.title + iosCurrentFixtureFailureProgress.text, /Firebase|BrowserStack|SDK|Swift|CI\b/i);
  const workflow = parseDocument(read('.github/workflows/web-integration-smoke.yml')).toJSON();
  for (const event of ['pull_request', 'push']) assert(workflow.on[event].paths.includes('tests/ios-current-fixture-result.test.mjs'));
  assert(Object.values(workflow.jobs).some(job => job.steps.some(step => step.run?.includes('tests/ios-current-fixture-result.test.mjs'))));
});

test('584 executes all eleven cases with three failures independently of its later job deadline', () => {
  const dir = 'docs/release/evidence/ios-fixture-failure-584-2026-11-05/', result = json(ios584FixtureResult.source);
  for (const row of result.records) assert.equal(sha(read(dir + row.file)), row.sha256);
  for (const row of json(dir + 'source-sha256.json').files)
    assert.equal(sha(read('docs/release/evidence/source-archive/' + row.sha256 + '.txt')), row.sha256);
  assert.equal(result.sourceCommit, '584c61b61453878e1bd2631b48ca2fef5e9de4d4');
  assert.equal(result.runId, 42085479023); assert.equal(result.jobId, 127462307445);
  assert.equal(result.conclusion, 'cancelled'); assert.equal(result.sdkBuild, 'success'); assert.equal(result.fixtureStep, 'failure');
  const job = json(dir + 'terminal-job.json'); assert.equal(job.status, 'completed'); assert.equal(job.conclusion, 'cancelled');
  assert.equal(job.steps.find(row => row.name === 'Run every built fixture test without rebuilding').conclusion, 'failure');
  assert.equal(job.steps.find(row => row.name === 'Dispose isolated simulator').conclusion, 'success');
  assert(json(dir + 'annotations.json').some(row => row.message.includes('50m0s')));
  assert(json(dir + 'annotations.json').some(row => row.message.includes('exit code 65')));
  assert.equal(json(dir + 'artifacts.json').total_count, 0);
  const cases = json(dir + 'cases.json'); assert.equal(cases.length, 11);
  assert.equal(cases.filter(row => row.status === 'passed').length, 8);
  assert.deepEqual(cases.filter(row => row.status === 'failed').map(row => row.name), [
    'testPersonalContactRequiresReviewAndPersistsItsRemoval', 'testTrackingAndSeatChangesInvalidateTheAcceptedSelection',
    'testPublishSearchAndBookingIdentifiers']);
  assert.equal((read(dir + 'selected-failures.txt').match(/: error:/g) ?? []).length, 5);
});

test('the fixture seed correction preserves real role clearing and every original screen assertion', () => {
  const dir = 'docs/release/evidence/ios-fixture-failure-584-2026-11-05/', result = json(ios584FixtureResult.source);
  assert(read(dir + 'seed-baseline.txt').includes('Publication fixture must seed resolved places after the final role transition'));
  const factory = read('ios/Sources/SportsGreenMooveApp/UITestAppStateFactory.swift');
  assert(factory.indexOf('["booking", "publish"].contains(route) ? .driver') < factory.indexOf('state.searchOrigin = Fixtures.origin'));
  assert(!factory.slice(factory.indexOf('switch route')).includes('state.selectedRole = .driver'));
  const native = read(dir + 'native-recheck.txt');
  assert(native.includes('UI fixture ownership checks passed: thirteen established route owners and actual second-child/two-seat booking confirmation'));
  assert(native.includes('SportsGreenMooveNativeChecks passed')); assert(native.includes('OwnedPlacesAdapterChecks passed'));
  const script = read('scripts/check-ios-native-plan.sh');
  for (const marker of ['-D DEBUG', 'UITestAppStateFactory.swift', 'UITestRouteChecks.swift', 'UITestEmergencyContacts.swift',
    'UITestTeamChat.swift', 'UITestRideChat.swift', 'UITestMembershipGateway.swift', 'UITestProfileCityGateway.swift']) assert(script.includes(marker));
  const helper = read('ios/UITests/SportsGreenMooveUITests/OwnedSearchFlowChecks.swift');
  for (const marker of ['XCTAssertTrue(booking.isEnabled)', 'XCTAssertTrue(booking.isHittable)', 'app.debugDescription.prefix(32_000)',
    'alert.waitForExistence(timeout: 6)', 'Demande envoyée: booking-child-2-2', 'alert.buttons["OK"].tap()']) assert(helper.includes(marker));
  assert.equal(result.bookingUiCauseConfirmed, false); assert.equal(result.actualFixtureBookingConfirmationPassedLocally, true);
  for (const key of ['candidateSdkAccepted', 'candidateUiAccepted', 'physicalDeviceAccepted', 'releaseComplete']) assert.equal(result[key], false);
});

test('a short 584 result preserves every older flow, media reference, note and blocker without releasing either platform', () => {
  assert.deepEqual(content.ios584FixtureResult, ios584FixtureResult);
  assert.deepEqual(content.updates.filter(row => row.source === ios584FixtureResultProgress.source), [ios584FixtureResultProgress]);
  assert(partitionUpdates(content.updates).previous.some(row => row.source === ios584FixtureResultProgress.source));
  assert.doesNotMatch(ios584FixtureResultProgress.title + ios584FixtureResultProgress.text, /Firebase|BrowserStack|SDK|Swift|Xcode|CI\b/i);
  const before = json('docs/release/evidence/ios-fixture-failure-584-2026-11-05/portal-before.json');
  for (const row of before.flows) assert.equal(sha(JSON.stringify(content.flows.find(flow => flow.id === row.id))), row.sha256);
  for (const hash of before.updates) assert(content.updates.some(row => sha(JSON.stringify(row)) === hash));
  assert.equal(sha(JSON.stringify(content.blockers)), before.blockers);
  assertCurrentIosAutomatedEvidence();
});

test('6e89 completes below the unchanged deadline with nine passes and all four actual failure records', () => {
  const dir = 'docs/release/evidence/ios-fixture-failure-6e89-2026-11-05/', result = json(ios6e89FixtureResult.source);
  for (const row of result.records) assert.equal(sha(read(dir + row.file)), row.sha256);
  for (const row of json(dir + 'source-sha256.json').files)
    assert.equal(sha(read('docs/release/evidence/source-archive/' + row.sha256 + '.txt')), row.sha256);
  assert.equal(result.sourceCommit, '6e898a90b23fc0c2ea8c951af02a7246c760ad84');
  assert.equal(result.runId, 42096199969); assert.equal(result.jobId, 127490262040);
  assert.equal(result.conclusion, 'failure'); assert.equal(result.sdkBuild, 'success');
  assert.equal(result.fixtureStep, 'failure'); assert.equal(result.deadlineMinutes, 50); assert.equal(result.timedOut, false);
  const job = json(dir + 'terminal-job.json');
  assert.equal(job.status, 'completed'); assert.equal(job.conclusion, 'failure');
  assert(new Date(job.completedAt) - new Date(job.startedAt) < 25 * 60_000);
  assert.equal(job.steps.find(row => row.name === 'Dispose isolated simulator').conclusion, 'success');
  const cases = json(dir + 'cases.json'); assert.equal(cases.length, 11);
  assert.equal(cases.filter(row => row.status === 'passed').length, 9);
  assert.deepEqual(cases.filter(row => row.status === 'failed').map(row => row.name), [
    'testTrackingAndSeatChangesInvalidateTheAcceptedSelection', 'testPublishSearchAndBookingIdentifiers']);
  assert.equal(cases.find(row => row.name === 'testPersonalContactRequiresReviewAndPersistsItsRemoval').status, 'passed');
  assert.equal((read(dir + 'selected-failures.txt').match(/: error:/g) ?? []).length, 4);
  assert.equal(json(dir + 'artifacts.json').total_count, 0);
  for (const key of ['emergencyReliabilityAccepted', 'bookingUiCauseConfirmed', 'subsequentCandidateUiAccepted',
    'physicalDeviceAccepted', 'releaseComplete']) assert.equal(result[key], false);
});

test('the latest simulation-only result keeps every older portal record and release requirement', () => {
  assert.deepEqual(content.ios6e89FixtureResult, ios6e89FixtureResult);
  assert.deepEqual(content.updates.filter(row => row.source === ios6e89FixtureResultProgress.source), [ios6e89FixtureResultProgress]);
  assert(partitionUpdates(content.updates).previous.some(row => row.source === ios6e89FixtureResultProgress.source));
  assert(ios6e89FixtureResultProgress.text.includes('simulation'));
  assert.doesNotMatch(ios6e89FixtureResultProgress.title + ios6e89FixtureResultProgress.text, /Firebase|BrowserStack|SDK|Swift|Xcode|CI\b/i);
  const before = json('docs/release/evidence/ios-fixture-failure-6e89-2026-11-05/portal-before.json');
  assert.equal(before.updates.length, 445);
  for (const row of before.flows) assert.equal(sha(JSON.stringify(content.flows.find(flow => flow.id === row.id))), row.sha256);
  for (const hash of before.updates) assert(content.updates.some(row => sha(JSON.stringify(row)) === hash));
  assert.equal(sha(JSON.stringify(content.blockers)), before.blockers);
  assertCurrentIosAutomatedEvidence();
});

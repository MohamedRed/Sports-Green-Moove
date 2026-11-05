import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {parseDocument} from 'yaml';
import {content} from '../partner-portal/content.mjs';
import {iosViewportRecheck, iosViewportRecheckProgress} from '../partner-portal/ios-viewport-recheck.mjs';
import {iosA37FixturePassProgress} from '../partner-portal/ios-a37-fixture-pass.mjs';
import {partitionUpdates} from '../partner-portal/src/render.js';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const app = 'ios/Sources/SportsGreenMooveApp/';
const json = path => JSON.parse(read(path));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const dir = 'docs/release/evidence/ios-viewport-35f-2026-11-05/';
const report = json(iosViewportRecheck.source);

test('authenticated content and navigation occupy separate layout regions instead of overlapping', () => {
  const shell = read(app + 'AppShell.swift');
  const body = shell.slice(shell.indexOf('private func authenticatedShell'), shell.indexOf('private var alertBinding'));
  assert(body.includes('VStack(spacing: 0)'));
  assert(!body.includes('ZStack'));
  assert(body.indexOf('activeContent(access)') < body.indexOf('SGMTabBar('));
  const nav = read(app + 'SGMNavigation.swift');
  assert(nav.includes('ZStack(alignment: .bottom)'));
  assert(nav.includes('.padding(.bottom, (SGMSize.navBar - SGMSize.fab) / 2 + 12)'));
  assert(!nav.includes('.offset(y: -12)'));
  assert(nav.includes('.accessibilityElement(children: .contain)'));
  assert(nav.includes('.accessibilityIdentifier("navigation.bar")'));
  assert.equal(read(app + 'SGMComponents.swift').match(/var bottomPadding: CGFloat = ([^\n]+)/)?.[1], 'SGMSpace.s4');
});

test('the existing child booking case reveals its real action and verifies it stays above navigation', () => {
  const helper = read('ios/UITests/SportsGreenMooveUITests/OwnedSearchFlowChecks.swift');
  for (const part of ['app.otherElements["navigation.bar"]', 'app.scrollViews["search.screen"]',
    'for _ in 0..<3', 'if booking.isHittable && search.frame.contains(booking.frame)',
    'XCTAssertTrue(booking.isEnabled)', 'XCTAssertTrue(booking.isHittable)',
    'XCTAssertLessThanOrEqual(booking.frame.maxY, navigation.frame.minY)',
    'XCTAssertFalse(app.scrollViews["messages.screen"].exists)',
    'alert.waitForExistence(timeout: 6)', 'Demande envoyée: booking-child-2-2', 'alert.buttons["OK"].tap()']) assert(helper.includes(part), part);
  assert(!helper.includes('sleep('));
});

test('team send readiness is observed without removing its original enabled, sent-body or empty-draft assertions', () => {
  const helper = read('ios/UITests/SportsGreenMooveUITests/TeamChatFlowChecks.swift');
  for (const part of ['NSPredicate(format: "enabled == true")', 'XCTWaiter.wait(for: [enabled], timeout: 6)',
    'XCTAssertTrue(send.isEnabled); send.tap()', 'app.staticTexts["Message de test isolé"].waitForExistence(timeout: 6)',
    'XCTAssertEqual(editor.value as? String, "")']) assert(helper.includes(part), part);
  assert(read(app + 'TeamChatState.swift').includes('var canSend: Bool { canCompose && !busy && TeamChatWire.validBody'));
  assert(read(app + 'TeamChatMessageViews.swift').includes('.disabled(!state.canSend)'));
  assert(!helper.includes('sleep(') && !helper.includes('XCTSkip'));
});

test('all eleven actual 35f outcomes and its wrong-screen booking observation remain source-bound failures', () => {
  for (const row of report.records) assert.equal(sha(read(dir + row.file)), row.sha256);
  for (const row of json(dir + 'source-sha256.json').files)
    assert.equal(sha(read('docs/release/evidence/source-archive/' + row.sha256 + '.txt')), row.sha256);
  assert.equal(report.sourceCommit, '35f23fc6ae4f5fba8bc93ded64050df4d38b6d46');
  assert.equal(report.runId, 42100296847); assert.equal(report.jobId, 127503931215);
  const job = json(dir + 'terminal-job.json'); assert.equal(job.status, 'completed'); assert.equal(job.conclusion, 'failure');
  assert.equal(job.steps.find(row => row.name === 'Compile app and all fixture test bundles').conclusion, 'success');
  assert.equal(job.steps.find(row => row.name === 'Dispose isolated simulator').conclusion, 'success');
  const cases = json(dir + 'cases.json'); assert.equal(cases.length, 11);
  assert.equal(cases.filter(row => row.status === 'passed').length, 9);
  assert.deepEqual(cases.filter(row => row.status === 'failed').map(row => row.name), [
    'testTrackingAndSeatChangesInvalidateTheAcceptedSelection', 'testMessagesChatAndRatingIdentifiers']);
  assert.equal(cases.find(row => row.name === 'testPublishSearchAndBookingIdentifiers').status, 'passed');
  assert.equal((read(dir + 'selected-failures.txt').match(/: error:/g) ?? []).length, 4);
  assert(read(dir + 'booking-accessibility.txt').includes("identifier: 'messages.screen'"));
  assert(!read(dir + 'booking-accessibility.txt').includes("identifier: 'search.screen'"));
  assert.equal(report.exactBookingHitCoordinateKnown, false); assert.equal(json(dir + 'artifacts.json').total_count, 0);
});

test('controlled booking/navigation and settled send boundaries never accept native hit testing or remove the send policy', () => {
  assert(read(dir + 'source-contract-baseline.txt').includes('# fail 3'));
  assert(read(dir + 'source-contract-recheck.txt').includes('# fail 0'));
  const native = read(dir + 'native-recheck.txt'); assert(native.includes('SportsGreenMooveNativeChecks passed'));
  assert(native.includes('TeamChat send readiness passed: four settled read boundaries'));
  assert(native.includes('Actual fixture booking retains search navigation after its exact acknowledgement'));
  const records = json(dir + 'source-sha256.json').files.filter(row => row.path.endsWith('TeamChatState.swift'));
  assert.equal(records.length, 2); assert.equal(records[0].sha256, records[1].sha256);
  for (const key of ['currentNativeLayoutAccepted', 'currentNativeUiAccepted', 'teamSendPolicyChanged',
    'physicalDeviceAccepted', 'releaseComplete']) assert.equal(report[key], false);
});

test('Android Wi-Fi readiness and a separate image download failure are not chat or remote-stop acceptance', () => {
  const network = json(dir + 'android85e-network-preparation.json');
  assert.equal(network.initialNetwork.capabilityObservation.active.validated, true);
  assert.equal(network.preparationFailure.hasDefaultDataSubscription, false);
  assert.equal(network.preparationFailure.cellularAvailableCallbacks, 0);
  assert.equal(network.preparationFailure.backendReachable, true);
  assert.equal(network.failedPhase, 'network-preparation'); assert.equal(network.completed, false); assert.deepEqual(network.network, []);
  const download = json(dir + 'android38b-image-download.json');
  assert.equal(download.jobId, 127524723322); assert.equal(download.conclusion, 'failure');
  assert(download.selectedError.includes('Error reading Zip content from a SeekableByteChannel'));
  assert.equal(download.appFlowExecuted, false); assert.equal(download.downloadCauseConfirmed, false);
});

test('the latest partial result replaces stale full-pass headlines without deleting any previous portal or release requirement', () => {
  assert.deepEqual(content.iosViewportRecheck, iosViewportRecheck);
  const {recent, previous} = partitionUpdates(content.updates);
  assert(recent.some(row => row.source === iosViewportRecheckProgress.source));
  assert(previous.some(row => row.source === iosA37FixturePassProgress.source));
  assert(!recent.some(row => row.source === iosA37FixturePassProgress.source));
  assert(iosViewportRecheckProgress.text.includes('simulation'));
  assert.doesNotMatch(iosViewportRecheckProgress.title + iosViewportRecheckProgress.text, /Firebase|BrowserStack|Android|SDK|Swift|CI\b/);
  const before = json(dir + 'portal-before.json'); assert.equal(before.updates.length, 447);
  for (const row of before.flows) assert.equal(sha(JSON.stringify(content.flows.find(flow => flow.id === row.id))), row.sha256);
  for (const hash of before.updates) assert(content.updates.some(row => sha(JSON.stringify(row)) === hash));
  assert.equal(sha(JSON.stringify(content.blockers)), before.blockers);
  const workflow = parseDocument(read('.github/workflows/web-integration-smoke.yml')).toJSON();
  for (const event of ['pull_request', 'push']) assert(workflow.on[event].paths.includes('tests/ios-navigation-viewport.test.mjs'));
  assert(Object.values(workflow.jobs).some(job => job.steps?.some(step => step.run === 'node --test tests/ios-navigation-viewport.test.mjs')));
  assert.equal(parseDocument(read('.github/workflows/ios-mvp-verification.yml')).toJSON().jobs['ios-fixture-verification']['timeout-minutes'], 50);
  for (const id of ['ios_sdk_build_ci', 'ios_fixture_ui_ci'])
    assert.equal(json('docs/release/evidence-manifest.json').automatedUserFlowEvidence.items.find(row => row.id === id).status, 'pending');
});

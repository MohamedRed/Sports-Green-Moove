import test from 'node:test';
import assert from 'node:assert/strict';
import {assertCurrentIosAutomatedEvidence} from '../scripts/qa/ios-fixture-release-evidence.mjs';
import {assertUnchangedIosFixtureWorkload, withMembershipFailureObservation} from '../scripts/qa/ios-fixture-workload-contract.mjs';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {parseDocument} from 'yaml';
import {content} from '../partner-portal/content.mjs';
import {iosInputControls, iosInputControlsProgress} from '../partner-portal/ios-input-controls.mjs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const json = path => JSON.parse(read(path));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const folder = 'docs/release/evidence/ios-input-controls-2026-11-05/', app = 'ios/Sources/SportsGreenMooveApp/';
const report = json(iosInputControls.source), index = json(iosInputControls.checksums);
const frozen = (path, commit) => {
  const row = index.files.find(row => row.path === path && row.commit === commit); assert(row, path);
  const bytes = read('docs/release/evidence/source-archive/' + row.sha256 + '.txt'); assert.equal(sha(bytes), row.sha256); return bytes;
};
test('twelve old-state truncation reproductions and candidate boundaries remain actual separate executions', () => {
  for (const row of report.records) assert.equal(sha(read(folder + row.file)), row.sha256);
  for (const row of index.files) assert.equal(sha(read('docs/release/evidence/source-archive/' + row.sha256 + '.txt')), row.sha256);
  assert.match(read(folder + 'baseline-result.txt'), /12 baseline draft truncation reproductions \(not accepted\)/);
  assert.match(read(folder + 'candidate-state-result.txt'), /12 exact-body read\/input boundaries passed/);
  const complete = read(folder + 'complete-native-result.txt');
  for (const marker of ['12 exact-body read/input boundaries passed', 'SportsGreenMooveNativeChecks passed',
    'Membership fixture state passed: approve', 'Membership fixture state passed: reject']) assert(complete.includes(marker));
  assert.deepEqual(report.localChecks, {baselineReproductions: 12, candidateInputBoundaries: 12,
    nativePlanExitCode: 0, signatureExitCode: 0, syntaxExitCode: 0, actualFixtureDecisions: 2});
});
test('only private editing is detached from read busy state, while sends and unsettled intents remain guarded', () => {
  const old = frozen(app + 'TeamChatState.swift', report.baselineCommit), state = read(app + 'TeamChatState.swift');
  assert(old.includes('error == nil && !busy && composer.loaded'));
  assert(state.includes('var canCompose: Bool { live && loaded && title != nil && error == nil && composer.loaded }'));
  assert(state.includes('var canSend: Bool { canCompose && !busy && TeamChatWire.validBody'));
  assert(state.includes('if canCompose && composer.pending == nil { composer.edit(body) }'));
  assert(read(app + 'TeamChatMessageViews.swift').includes('.disabled(!state.canCompose || state.composer.pending != nil)'));
  for (const part of ['access.begin()', 'access.finish(work)', 'access.owns(work)', 'generation == ticket', 'composer.acknowledge(prepared.draft)']) assert(state.includes(part));
  assert.equal(state, frozen(app + 'TeamChatState.swift', 'candidate'));
  assert.equal(read(app + 'TeamChatComposer.swift'), frozen(app + 'TeamChatComposer.swift', report.baselineCommit));
});
test('controlled input regression covers all read completion boundaries without UI injection or automatic sends', () => {
  const path = 'ios/Tests/SportsGreenMooveNativeChecks/TeamChatEditingChecks.swift', driver = read(path);
  assert(driver.includes('["refresh", "earlier", "read"]')); assert(driver.includes('["success", "failure", "background", "account"]'));
  for (const part of ['state.edit(complete)', 'saved?.body == expected', 'persisted?.body == expected',
    'state.busy && !state.canSend', 'check(sends.isEmpty', '!scope.busy && !state.busy']) assert(driver.includes(part));
  assert.doesNotMatch(driver, /typeText|XCTSkip|sleep\(|setData|callable|catch.*return/);
  assert(read('scripts/check-ios-native-plan.sh').includes('TeamChatEditingChecks.swift'));
  assert(read('scripts/check-ios-native-plan.sh').includes('scripts/qa/check-ios-membership-fixture.sh'));
  const fixture = read('scripts/qa/check-ios-membership-fixture.sh');
  assert(fixture.includes('"$APP/UITestMembershipGateway.swift"')); assert(fixture.includes('"$APP/MembershipReviewState.swift"'));
  assert(fixture.includes('"$BUILD/check" approve')); assert(fixture.includes('"$BUILD/check" reject'));
  assert.doesNotMatch(fixture, /firebase|curl|wget|xcrun|simctl|fallback/i);
});
test('UI candidates preserve the real city button and full-size club target without weakening existing tests', () => {
  const city = read(app + 'ProfileCityEntry.swift');
  assert(frozen(app + 'ProfileCityEntry.swift', report.baselineCommit).includes('.accessibilityElement(children: .ignore)'));
  assert.doesNotMatch(city, /accessibilityElement\(children: \.ignore\)/);
  for (const part of ['ProfileSettingRow(', '.accessibilityIdentifier("profile.city")', '.accessibilityValue(label)',
    '.disabled(!state.live || state.busy)', 'ProfileCityEditor(access: access, gateway: gateway)']) assert(city.includes(part));
  const review = read(app + 'MembershipReviewScreen.swift'); assert(review.includes('.frame(minHeight: 44).contentShape(Rectangle())'));
  assert.equal(read(app + 'MembershipReviewState.swift'), frozen(app + 'MembershipReviewState.swift', report.baselineCommit));
  for (const row of index.files.filter(row => row.path.startsWith('ios/UITests/') && row.commit === 'candidate')) {
    const original = frozen(row.path, report.baselineCommit);
    assert.equal(frozen(row.path, 'candidate'), original);
    let expected = row.path.endsWith('/SportsGreenMooveUITests.swift')
      ? original.replace('        verifyTeamChat(in: app)', '        verifyRideChat(in: app)\n        verifyTeamChat(in: app)')
        .replace('        assertExists("active-ride.emergency-contact", in: app)',
          '        assertExists("active-ride.emergency-contact", in: app)\n        verifyActiveRideChat(in: app)')
      : row.path.endsWith('/SearchConsentFlowTests.swift')
        ? original.replace('        XCTAssertEqual(consent.value as? String, "Accordé")\n    }\n\n    @MainActor private func launchSearch',
          '        XCTAssertEqual(consent.value as? String, "Accordé")\n        verifyOwnedChildBooking(in: app)\n    }\n\n    @MainActor private func launchSearch') : original;
    if (row.path.endsWith('/MembershipFlowChecks.swift')) expected = withMembershipFailureObservation(expected);
    if (row.path.endsWith('/EmergencyContactFlowTests.swift')) {
      expected = original.replaceAll('        app.scrollViews.firstMatch.swipeDown()\n        app.buttons["emergency.back"].tap(); entry.tap()',
        '        returnToOptions(in: app); entry.tap()').replace(/\n}\n$/, `

    @MainActor private func returnToOptions(in app: XCUIApplication) {
        let back = app.buttons["emergency.back"]
        XCTAssertTrue(back.waitForExistence(timeout: 6))
        if !back.isHittable { app.scrollViews["emergency.screen"].swipeDown() }
        XCTAssertTrue(back.isHittable); back.tap()
        XCTAssertTrue(app.scrollViews["options.screen"].waitForExistence(timeout: 6))
    }
}
`);
    }
    if (row.path.endsWith('/TeamChatFlowChecks.swift')) {
      expected = expected.replace('    let send = app.buttons["team-chat.send"]\n',
        '    let send = app.buttons["team-chat.send"]\n' +
        '    let enabled = XCTNSPredicateExpectation(predicate: NSPredicate(format: "enabled == true"), object: send)\n' +
        '    XCTAssertEqual(XCTWaiter.wait(for: [enabled], timeout: 6), .completed)\n');
    }
    if (row.path.endsWith('/SearchConsentFlowTests.swift')) {
      const checkpoint = '        consent.tap()\n        app.buttons["search.action"].tap()\n        XCTAssertTrue(app.buttons["booking.request.action"].waitForExistence(timeout: 6))';
      assert(expected.includes(checkpoint));
      expected = expected.replace(checkpoint, checkpoint.replace('timeout: 6))', 'timeout: 6), String(app.debugDescription.prefix(16_000)))'));
    }
    assert.equal(read(row.path), expected);
  }
});
test('existing eleven-case workload, concurrency, deadline and capture policy remain unchanged', () => {
  const path = '.github/workflows/ios-mvp-verification.yml', current = parseDocument(read(path)).toJSON();
  const old = parseDocument(frozen(path, report.baselineCommit)).toJSON();
  assertUnchangedIosFixtureWorkload(current, old);
  assert.equal(current.jobs['ios-fixture-verification']['timeout-minutes'], 50);
  assert.equal(report.fixtureCases, 11); assert.equal(report.uiAssertionsChanged, false);
  assert(current.on.pull_request.paths.includes('tests/ios-input-controls.test.mjs'));
  const web = parseDocument(read('.github/workflows/web-integration-smoke.yml')).toJSON();
  for (const event of ['pull_request', 'push']) assert(web.on[event].paths.includes('tests/ios-input-controls.test.mjs'));
  assert(Object.values(web.jobs).some(job => job.steps.some(step => step.run?.includes('tests/ios-input-controls.test.mjs'))));
});
test('one short local note preserves earlier portal records and does not accept the three native journeys', () => {
  assert.deepEqual(content.iosInputControls, iosInputControls);
  assert.deepEqual(content.updates.filter(row => row.source === iosInputControlsProgress.source), [iosInputControlsProgress]);
  assert.doesNotMatch(iosInputControlsProgress.title + iosInputControlsProgress.text, /Firebase|BrowserStack|SDK|Swift|CI\b/i);
  const previous = json(folder + 'portal-before.json');
  for (const row of previous.flows) assert.equal(sha(JSON.stringify(content.flows.find(item => item.id === row.id))), row.sha256);
  for (const hash of previous.updates) assert(content.updates.some(row => sha(JSON.stringify(row)) === hash));
  assert.equal(sha(JSON.stringify(content.blockers)), previous.blockers);
  for (const key of ['membershipUiCauseProven', 'sdkLinkedBuildAccepted', 'nativeUiAccepted', 'physicalDeviceAccepted', 'releaseComplete']) assert.equal(report[key], false);
  for (const key of ['providerRequests', 'productionWrites', 'newPhoneSessions', 'newMedia']) assert.equal(report[key], 0);
  assertCurrentIosAutomatedEvidence();
});

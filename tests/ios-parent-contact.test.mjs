import assert from 'node:assert/strict';
import {assertCurrentIosAutomatedEvidence} from '../scripts/qa/ios-fixture-release-evidence.mjs';
import {readFileSync, readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {test} from 'node:test';
import {parseDocument} from 'yaml';
import {content} from '../partner-portal/content.mjs';
import {iosParentContact, iosParentContactProgress} from '../partner-portal/ios-parent-contact.mjs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const sha = data => createHash('sha256').update(data).digest('hex');
const app = 'ios/Sources/SportsGreenMooveApp/';
const folder = 'docs/release/evidence/ios-parent-contact-2026-11-05/';

test('the parent picker uses server verification history rather than declared children or membership flags', () => {
  const source = read(app + 'FirebaseEmergencyContactGateway.swift');
  const request = read(app + 'EmergencyContactRequest.swift');
  assert(source.includes('request: .guardianContacts(cursor: cursor)'));
  assert(request.includes('return "listMyGuardianVerifications"'));
  assert(request.includes('GuardianContactWire.validCursor(cursor)'));
  assert(source.includes('GuardianContactWire.page($0, uid: uid)'));
  assert.doesNotMatch(source, /listClubGuardianVerifications|collection\(|setCustomUserClaims|guardianUserIds/);
  const picker = read(app + 'GuardianContactPicker.swift');
  for (const fragment of ['access.context.role == .parent', '!access.context.grantedRoles.contains(.child)',
    'state.select(row)', 'state.personal()', 'state.more()', 'state.suspend()', 'state.close()', '.id(editorId)',
    '.disabled(state.busy || !row.selectable)', '.fixedSize(horizontal: false, vertical: true)']) assert(picker.includes(fragment));
  assert.doesNotMatch(picker, /appState.children|listChildren|tracking|CLLocation|FirebaseAuth|setCustomUserClaims/);
  assert(read(app + 'EmergencyContactScreen.swift').includes('EmergencyContactHost(access: access'));
});

test('strict guardian pages bind the parent, status, nullable names, revision and exact child/club target', () => {
  const model = read(app + 'GuardianContactModels.swift');
  for (const fragment of ['row.parentUserId == uid', 'page.items.count <= 20', 'row.revision > 0', 'row.allowedActions.allSatisfy',
    'status == .verified && childName != nil && clubName != nil', 'row.keys.contains(key)', 'Set(page.items.map(\\.target))',
    '(1...16_384).contains(value.utf8.count)', 'value.utf8.allSatisfy']) assert(model.includes(fragment));
  const state = read(app + 'GuardianContactState.swift');
  for (const fragment of ['access.begin()', 'access.finish(work)', 'access.requireCurrent(work)', 'generation == ticket',
    'next != requested && !seen.contains(next)', '$0.id == next.id || $0.target == next.target',
    'choice.selectable, items.contains(choice)', 'let target = choice.target; close(); return target',
    'clear(); self.error =', 'access.context.role == .parent']) assert(state.includes(fragment));
  assert.doesNotMatch(state, /Task.sleep|retry|while |repeat |print\(|NSLog|write\(to:|UserDefaults/);
});

test('target navigation confirms discarded edits and constructs a fresh editor with the exact target', () => {
  const screen = read(app + 'EmergencyContactScreen.swift');
  assert(screen.includes('emergency.subject.child')); assert(screen.includes('emergency.subject.club'));
  for (const fragment of ['if state.dirty { discard = .chooseTarget }', 'case .chooseTarget: onChooseTarget?()',
    'presenting: discard) { action in', 'state.pending != nil { state.cancelReview() }']) assert(screen.includes(fragment));
  const host = read(app + 'GuardianContactPicker.swift');
  assert(host.includes('showEditor(.managed($0))')); assert(host.includes('guard access.isCurrent else { return }'));
  assert(host.includes('selected = scope; editorId = UUID(); picking = false'));
  const state = read(app + 'EmergencyContactState.swift');
  assert(state.includes('live && allowedScope && !scope.readOnly'));
  assert(state.includes('case .managed(.child): return access.context.role == .parent'));
  assert(state.includes('expectedChildInstanceId: view.childInstanceId'));
});

test('executed local parent checks remain distinct from the eleven-case SDK/UI and physical acceptance', () => {
  const report = JSON.parse(read(iosParentContact.source));
  assert.equal(report.checkedAt, iosParentContact.checkedAt);
  assert.equal(report.baselineCommit, '84c9b627acfcebbddaad147bdd282af8483ce943');
  assert.deepEqual(report.localChecks, {nativePlanExitCode: 0, signatureExitCode: 0, controlledPhoneExitCode: 0,
    malformedPageCasesRejected: 14, invalidCursorInputsDenied: 5, failedPaginationGroups: 5, nonparentRolesDenied: 4,
    delayedPageBoundaries: 24, requiredFixtureCases: 11, newUiCasesPrepared: 1});
  for (const entry of report.logs) assert.equal(sha(read(folder + entry.file)), entry.sha256);
  assert.match(read(folder + 'native-result.txt'), /GuardianContactBoundaryChecks passed: 24/);
  assert.match(read(folder + 'native-result.txt'), /GuardianContactChecks passed: 14 malformed page cases/);
  assert.match(read(folder + 'native-result.txt'), /ParentEmergencyContactChecks passed: exact verified target/);
  assert.match(read(folder + 'native-result.txt'), /SportsGreenMooveNativeChecks passed/);
  assert.equal(report.parentChildContactEditorSourceWired, true);
  for (const key of ['sdkLinkedBuildAccepted', 'newFixtureUiExecuted', 'managerApprovalUiAccepted', 'realPhoneHandoffAccepted',
    'physicalDeviceAccepted', 'storeActionAccepted', 'newNativeMediaPublished', 'releaseComplete']) assert.equal(report[key], false);
  for (const key of ['providerRequests', 'productionWrites', 'realPayments', 'newPhoneSessions']) assert.equal(report[key], 0);
  for (const entry of JSON.parse(read(iosParentContact.checksums)).files)
    assert.equal(sha(read('docs/release/evidence/source-archive/' + entry.sha256 + '.txt')), entry.sha256, entry.path);
});

test('the additional parent UI case preserves all ten earlier cases and opens no real phone or capture', () => {
  const path = 'ios/UITests/SportsGreenMooveUITests/';
  const added = read(path + 'ParentEmergencyContactFlowTests.swift');
  const cases = readdirSync(new URL('../' + path, import.meta.url)).filter(file => file.endsWith('.swift'))
    .flatMap(file => [...read(path + file).matchAll(/func (test\w+)\(/g)].map(match => match[1]));
  assert.equal(cases.length, 11); assert.equal(new Set(cases).size, 11);
  for (const text of ['emergency.targets.more', 'Continuer la modification', 'Abandonner les modifications',
    'emergency.targets.personal', 'emergency.remove', 'Contact enfant fictif']) assert(added.includes(text));
  assert.doesNotMatch(added, /XCTSkip|captureApproved|screenshot\(|sleep\(|buttons\["emergency.phone.open"\]\.tap/);
  assert(read('scripts/check-ios-native-plan.sh').includes('GuardianContactBoundaryChecks.swift'));
  assert(read('scripts/check-ios-support-concurrency.sh').includes('GuardianContactModels.swift'));
  assert(read('scripts/qa/check-ios-emergency-phone.mjs').includes("'GuardianContactModels.swift'"));
});

test('the independently failed chat preparation keeps its original source, cleanup and incomplete scope', () => {
  const report = JSON.parse(read(iosParentContact.source)).androidFocusedRecheck;
  assert.equal(report.runId, 41935572889); assert.equal(report.jobId, 126943054501);
  assert.equal(report.sourceCommit, '84c9b627acfcebbddaad147bdd282af8483ce943');
  assert.equal(report.jobConclusion, 'failure'); assert.equal(report.failedPhase, 'network-preparation');
  assert.equal(report.preparationDeadlineMs, 30_000); assert.equal(report.completed, false);
  assert.equal(report.cellularRequestReleased, true); assert.equal(report.wifiRequestReleased, true);
  assert.equal(report.deviceRestored, true); assert.equal(report.deviceRestorationVerified, true); assert.equal(report.hostGone, true);
  assert.equal(report.flowAccepted, false); assert.equal(report.rootCauseConfirmed, false);
  for (const record of report.records) assert.equal(sha(read(folder + record.file)), record.sha256);
  const projection = JSON.parse(read(folder + 'chat-preparation-projection.json'));
  assert.equal(projection.failedPhase, report.failedPhase); assert.equal(projection.completed, false);
  assert(!Object.hasOwn(projection, 'runId') && !Object.hasOwn(projection, 'projectId'));
});

test('the concise portal update and required workflow coverage preserve pending iPhone requirements', () => {
  assert.deepEqual(content.iosParentContact, iosParentContact);
  assert.deepEqual(content.updates.filter(item => item.source === iosParentContactProgress.source), [iosParentContactProgress]);
  assert.doesNotMatch(iosParentContactProgress.title + iosParentContactProgress.text, /Firebase|BrowserStack|Android|SDK|Swift|CI\b/i);
  const path = 'tests/ios-parent-contact.test.mjs';
  const web = parseDocument(read('.github/workflows/web-integration-smoke.yml')).toJSON();
  for (const event of ['pull_request', 'push']) assert(web.on[event].paths.includes(path));
  assert(Object.values(web.jobs).some(job => job.steps.some(step => step.run?.includes(path))));
  const ios = parseDocument(read('.github/workflows/ios-mvp-verification.yml')).toJSON();
  assert(ios.on.pull_request.paths.includes(path)); assert.equal(ios.jobs['ios-fixture-verification']['timeout-minutes'], 50);
  assertCurrentIosAutomatedEvidence();
});

test('three observer regressions and the parent replay pass without accepting the failed complete native gate', () => {
  const report = JSON.parse(read(iosParentContact.source)).androidMainRecheck;
  assert.equal(report.runId, 41935572889); assert.equal(report.jobId, 126943053716);
  assert.equal(report.sourceCommit, '84c9b627acfcebbddaad147bdd282af8483ce943');
  assert.equal(report.runConclusion, 'failure'); assert.equal(report.jobConclusion, 'failure');
  for (const record of report.records) assert.equal(sha(read(folder + record.file)), record.sha256);
  const ordinary = JSON.parse(read(folder + 'android-ordinary-results.json'));
  assert.equal(ordinary.complete, true); assert.equal(ordinary.caseCount, 354);
  assert.equal(ordinary.passed, 299); assert.equal(ordinary.skipped, 55); assert.equal(ordinary.failed, 0);
  const observers = ordinary.cases.filter(item => item.className.endsWith('ActivityWindowObservationTest'));
  assert.equal(observers.length, 3); assert(observers.every(item => item.status === 'passed'));
  const parent = JSON.parse(read(folder + 'android-parent-results.json'));
  assert.equal(parent.checks.length, 8); assert(parent.checks.every(item => item.status === 'passed'));
  assert.deepEqual(JSON.parse(read(folder + 'android-suite-status.json')), {
    scope: 'native-suite-exit-status-not-flow-verification', ordinaryTests: 0, componentEvidence: 0, localReplay: 1,
  });
  const copy = JSON.parse(read(folder + 'android-transfer-projection.json'));
  assert.equal(copy.phase, 'trip-change-inputs'); assert.equal(copy.status, 1);
  assert.equal(report.observerNativeExecutionAccepted, true); assert.equal(report.sourceBoundParentReplayAccepted, true);
  for (const key of ['fullNativeGateAccepted', 'copyRootCauseConfirmed', 'rootLossCauseConfirmed', 'physicalDeviceAccepted', 'releaseComplete'])
    assert.equal(report[key], false);
  assert.equal(JSON.parse(read(folder + 'android-host-disposal.json')).targetExitObserved, true);
});

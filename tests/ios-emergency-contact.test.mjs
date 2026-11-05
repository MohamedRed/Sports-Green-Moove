import assert from 'node:assert/strict';
import {assertCurrentIosAutomatedEvidence} from '../scripts/qa/ios-fixture-release-evidence.mjs';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {test} from 'node:test';
import {parseDocument} from 'yaml';
import {content} from '../partner-portal/content.mjs';
import {iosEmergencyContact, iosEmergencyContactProgress} from '../partner-portal/ios-emergency-contact.mjs';
import {iosSignOutFixturePass, iosSignOutFixturePassProgress} from '../partner-portal/ios-signout-fixture-pass.mjs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const app = 'ios/Sources/SportsGreenMooveApp/';
const folder = 'docs/release/evidence/ios-emergency-contact-2026-11-04/';

test('the example number and static ride action are replaced by account-owned contact entries, including child Home', () => {
  assert.doesNotMatch(read(app + 'OptionsScreen.swift'), /\+32 470 00 00 00/);
  assert.doesNotMatch(read(app + 'SecondaryScreens.swift'), /Contact parent disponible|meta: "APPELER"/);
  for (const file of ['OptionsScreen', 'SecondaryScreens', 'HomeScreen']) assert(read(app + file + '.swift').includes('EmergencyContactEntry(access: access'));
  const screen = read(app + 'EmergencyContactScreen.swift');
  for (const fragment of ['.childRide(rideId) : .managed(.personal)', '.disabled(!access.isCurrent)',
    'state.pending', 'state.confirmSave()', 'state.cancelReview()', 'state.dial(using: opener)',
    'state.suspend()', 'state.close()', '.interactiveDismissDisabled(state.dirty || state.busy)',
    '.fixedSize(horizontal: false, vertical: true)', '.scrollDismissesKeyboard(.interactively)']) assert(screen.includes(fragment));
  assert.doesNotMatch(screen, /startRide|Tracking|requestAuthorization|CLLocation|tel:|Contact parent disponible/);
  assert.match(read(app + 'HomeScreen.swift'), /if access.context.grantedRoles.contains\(.child\)/);
});

test('private contact reads and writes use the exact server protocol and retain account ownership around the SDK', () => {
  const gateway = read(app + 'FirebaseEmergencyContactGateway.swift');
  const request = read(app + 'EmergencyContactRequest.swift');
  for (const name of ['getEmergencyContact', 'saveEmergencyContact', 'getCurrentChildRideEmergencyContact', 'getChildRideEmergencyContact']) assert(request.includes('"' + name + '"'));
  assert(gateway.includes('request: EmergencyContactRequest'));
  assert(gateway.includes('httpsCallable(request.name).call(input)'));
  assert.equal((gateway.match(/Auth.auth\(\).currentUser\?\.uid == uid/g) ?? []).length, 2);
  assert.equal((gateway.match(/try Task.checkCancellation\(\)/g) ?? []).length, 2);
  assert.doesNotMatch(gateway, /collection\(|print\(|NSLog|retry|fallback/i);
  assert(read(app + 'GatewayContracts.swift').includes('MessagesGateway, EmergencyContactGateway'));
  assert(read(app + 'MessagesInboxState.swift').includes('protocol MessagesGateway: PendingReviewGateway'));
  const wire = read(app + 'EmergencyContactWire.swift');
  for (const fragment of ['CFBooleanGetTypeID()', 'expectedChildInstanceId', 'version > 0', 'data.keys.contains("contact")',
    'data["accountUserId"] as? String == uid', 'data["subjectId"] as? String == uid', 'revision > operation.expectedRevision']) assert(wire.includes(fragment));
  const signature = read('scripts/check-ios-support-concurrency.sh');
  assert(signature.includes('FirebaseEmergencyContactGateway.swift')); assert(signature.includes('-warnings-as-errors'));
});

test('contact work pins a reviewed operation, rechecks before opening and refuses stale account, child or unsaved values', () => {
  const state = read(app + 'EmergencyContactState.swift');
  for (const fragment of ['private let access: AccountAccess', 'access.begin()', 'access.finish(work)',
    'access.requireCurrent(work)', 'generation == ticket', 'if generation == ticket { invalidate() }',
    'latest == expected', 'latest.childInstanceId == operation.expectedChildInstanceId',
    'pending = operation', 'let operation = pending', '!dirty && view?.contact != nil',
    'name = ""; phone = ""', 'access.context.grantedRoles.contains(.child)', 'return scope.readOnly']) assert(state.includes(fragment));
  const dial = state.slice(state.indexOf('func dial('));
  assert(dial.indexOf('gateway.emergencyContact') < dial.indexOf('opener.open(contact)'));
  assert(dial.indexOf('latest == expected') < dial.indexOf('opener.open(contact)'));
  assert.doesNotMatch(state, /Task.sleep|retry|print\(|NSLog|UserDefaults|write\(to:|startRide|requestAuthorization/);
});

test('actual controlled checks retain their original logs without claiming a native Phone or complete child editor', () => {
  const report = JSON.parse(read(iosEmergencyContact.source));
  assert.deepEqual(report.localChecks, {nativePlanExitCode: 0, signatureExitCode: 0, controlledPhoneExitCode: 0,
    malformedWireCasesRejected: 22, delayedStateBoundaries: 36, lateOpenerBoundaries: 6, invalidPhoneInputsDenied: 4,
    requiredFixtureCases: 10, newUiCasesPrepared: 2});
  for (const log of report.logs) { assert.equal(sha(read(folder + log.file)), log.sha256); assert.equal(log.exitCode, 0); }
  assert.match(read(folder + 'native-result.txt'), /EmergencyContactBoundaryChecks passed: 36/);
  assert.match(read(folder + 'native-result.txt'), /EmergencyPhoneCompletionChecks passed: 6/);
  assert.match(read(folder + 'phone-result.txt'), /4 invalid inputs denied, exact tel destination/);
  assert.match(read(folder + 'signature-result.txt'), /Owned callable signature checks passed/);
  for (const item of JSON.parse(read(iosEmergencyContact.checksums)).files) {
    assert.equal(sha(read('docs/release/evidence/source-archive/' + item.sha256 + '.txt')), item.sha256, item.path);
  }
  for (const key of ['sdkLinkedBuildAccepted', 'newFixtureUiExecuted', 'realPhoneHandoffAccepted', 'parentChildContactEditorImplemented',
    'physicalDeviceAccepted', 'storeActionAccepted', 'newNativeMediaPublished', 'releaseComplete']) assert.equal(report[key], false);
  for (const key of ['productionWrites', 'providerRequests', 'realPayments', 'newPhoneSessions']) assert.equal(report[key], 0);
  assert.equal(report.androidRecheck.responseStatus, 429); assert.equal(report.androidRecheck.conclusion, 'failure');
  assert.equal(report.androidRecheck.nativeObserverExecutionAccepted, false);
  assert.equal(sha(read(folder + report.androidRecheck.excerpt)), report.androidRecheck.excerptSha256);
});

test('the actual tel adapter has no guessed scheme, automatic action, retry or success claim about a connected call', () => {
  const adapter = read(app + 'SystemEmergencyPhone.swift');
  assert(adapter.includes('guard contact.isValid, let url = URL(string: "tel:" + contact.phone)'));
  assert.match(adapter, /UIApplication.shared.open\(url, options: \[:\]\)/);
  assert.doesNotMatch(adapter, /telprompt|telephony|https:|callConnected|retry|fallback|init\(/i);
  const controlled = read('tests/fixtures/ios-emergency-phone/Checks.swift');
  assert(controlled.includes('UIApplication.shared.requests.isEmpty'));
  assert(controlled.includes('UIApplication.shared.requests.count == 2'));
  assert(read('scripts/qa/check-ios-emergency-phone.mjs').includes('-strict-concurrency=complete'));
});

test('the eight-case source-bound iPhone pass remains separate from the two additive emergency fixtures and current pending gates', () => {
  const proof = JSON.parse(read(iosSignOutFixturePass.source));
  assert.equal(proof.sourceCommit, '4582c3a45a107e59cc94185b1509fcc12b449935');
  assert.equal(proof.runId, 41924948921); assert.equal(proof.jobId, 126917403610);
  assert.equal(proof.conclusion, 'success'); assert.equal(proof.fixtureSuite.executed, 8); assert.equal(proof.fixtureSuite.failed, 0);
  for (const step of [proof.build, proof.fixtureExecution, proof.simulatorDisposal]) assert.equal(step.conclusion, 'success');
  assert.equal(proof.captureCollection.conclusion, 'skipped'); assert.equal(proof.captureUpload.conclusion, 'skipped');
  assert.equal(proof.artifactCount, 0); assert.equal(proof.currentEmergencyCandidateAccepted, false);
  const result = 'docs/release/evidence/ios-fixture-pass-4582-2026-11-04/' + proof.provenance.selectedResult;
  assert.equal(sha(read(result)), proof.provenance.selectedResultSha256);
  assert.match(read(result), /testProfileSignsOutToEmptyAuthentication.*passed/);
  assert.match(read(result), /Executed 8 tests, with 0 failures/);
  const suites = ['SportsGreenMooveUITests', 'SearchConsentFlowTests', 'SignOutFlowTests'];
  const original = suites.flatMap(suite => [...read(`ios/UITests/SportsGreenMooveUITests/${suite}.swift`).matchAll(/func (test\w+)\(/g)].map(match => match[1]));
  assert.deepEqual(proof.fixtureSuite.cases.map(item => item.name).sort(), original.sort());
  const added = read('ios/UITests/SportsGreenMooveUITests/EmergencyContactFlowTests.swift');
  assert.equal((added.match(/func test\w+\(/g) ?? []).length, 2);
  assert.doesNotMatch(added, /XCTSkip|captureApproved|\.screenshot\(|sleep\(|buttons\["emergency.phone.open"\]\.tap/);
  assertCurrentIosAutomatedEvidence();
});

test('the portal preserves one concise update per actual scope and both web and iPhone workflows cover the new contracts', () => {
  assert.deepEqual(content.iosEmergencyContact, iosEmergencyContact); assert.deepEqual(content.iosSignOutFixturePass, iosSignOutFixturePass);
  for (const update of [iosEmergencyContactProgress, iosSignOutFixturePassProgress]) {
    assert.deepEqual(content.updates.filter(item => item.source === update.source), [update]);
    assert.doesNotMatch(update.title + update.text, /Firebase|BrowserStack|Android|SDK|Swift|UIKit|CI\b/i);
  }
  const path = 'tests/ios-emergency-contact.test.mjs';
  const web = parseDocument(read('.github/workflows/web-integration-smoke.yml')).toJSON();
  for (const event of ['push', 'pull_request']) assert(web.on[event].paths.includes(path));
  assert(Object.values(web.jobs).some(job => job.steps.some(step => step.run?.includes(path))));
  const ios = parseDocument(read('.github/workflows/ios-mvp-verification.yml')).toJSON();
  assert(ios.on.pull_request.paths.includes(path)); assert.equal(ios.jobs['ios-fixture-verification']['timeout-minutes'], 50);
  assert(ios.jobs['ios-fixture-verification'].steps.some(step => step.run === 'node scripts/qa/check-ios-emergency-phone.mjs'));
});

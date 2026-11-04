import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {createHash} from 'node:crypto';
import {parseDocument} from 'yaml';
import {content} from '../partner-portal/content.mjs';
import {iosSearchSafety, iosSearchSafetyProgress} from '../partner-portal/ios-search-safety.mjs';
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const base = 'ios/Sources/SportsGreenMooveApp/';

test('retained local proof and the failed SDK run never accept iPhone or release readiness', () => {
  const folder = 'docs/release/evidence/ios-search-safety-2026-11-04/';
  const report = JSON.parse(read(iosSearchSafety.source));
  assert.equal(report.baseline.conclusion, 'failure');
  assert.equal(report.baseline.compilerErrors.length, 4);
  assert.equal(report.baseline.previousSupportDiagnosticsRecurred, false);
  assert.equal(report.baseline.simulatorDisposal, 'success');
  for (const local of [report.localLogic, report.localSignatureCompile]) {
    assert.equal(local.exitCode, 0);
    assert.equal(createHash('sha256').update(read(folder + local.log)).digest('hex'), local.logSha256);
  }
  const source = JSON.parse(read(folder + 'source-sha256.json'));
  for (const file of ['AppState+Search.swift', 'SearchFormState.swift', 'SearchRequestState.swift', 'FirebaseCallableBoundary.swift']) {
    assert.match(source[base + file], /^[a-f0-9]{64}$/);
  }
  for (const key of ['addedUiTestsExecuted', 'sdkLinkedBuildAccepted', 'iosEndToEndFlowsAccepted',
    'physicalDeviceEvidenceAccepted', 'productionWrites', 'realPaymentExercised', 'releaseComplete']) assert.equal(report[key], false);
  assert.equal(report.addedUiTests.length, 2);
  assert.deepEqual(content.iosSearchSafety, iosSearchSafety);
  const original = content.updates.filter(item => item.source === iosSearchSafetyProgress.source);
  assert.deepEqual(original, [iosSearchSafetyProgress]);
  assert.doesNotMatch(iosSearchSafetyProgress.title + iosSearchSafetyProgress.text, /BrowserStack|Firebase|SDK|backend|Swift|Xcode|CI\b/i);
});

test('search form owns consent reset and the screen invalidates every changed selection', () => {
  const form = read(base + 'SearchFormState.swift');
  assert.match(form, /guardianConsent: false/);
  for (const field of ['childUserId', 'requireChildTracking']) {
    assert(form.includes(`if ${field} != oldValue { guardianConsent = false }`));
  }
  const screen = read(base + 'SearchScreen.swift');
  assert.match(screen, /@State private var form = SearchFormState.initial\(\)/);
  assert.match(screen, /\.onChange\(of: form\) \{ _, _ in appState.invalidateSearch\(\) \}/);
  for (const target of ['origin', 'destination']) {
    assert(screen.includes(`appState.invalidatePlace(.${target})`));
  }
  assert.match(screen, /if let request = appState.prepareSearch\(form: form\)/);
  assert.match(screen, /Task \{ await appState.runSearch\(request\) \}/);
  assert.match(screen, /requestSearchMatch\(match, form: submittedForm, access: access\)/);
  assert.doesNotMatch(screen, /guardianConsent = true/);
});

test('request scope is checked before calls, response application and booking', () => {
  const state = read(base + 'AppState+Search.swift');
  assert.match(state, /form.validationMessage/);
  assert.match(state, /searchRequests.pending == request, session\?\.uid == request.context.uid/);
  assert.match(state, /searchRequests.finish\(request, uid: session\?\.uid, succeeded: true\)/);
  assert.match(state, /searchRequests.finish\(request, uid: session\?\.uid, succeeded: false\)/);
  assert.match(state, /searchRequests.permitsBooking\(SearchRequestContext\(uid: uid, form: form, origin: origin, destination: destination\)\)/);
  assert.match(state, /searchMatches.contains\(match\), match.tripId == match.summary.id/);
  const searchGateway = read(base + 'FirebaseSearchGateway.swift');
  assert.equal((searchGateway.match(/Auth.auth\(\).currentUser\?\.uid == criteria.requesterUserId/g) ?? []).length, 2);
  const app = read(base + 'AppState.swift');
  const reset = app.slice(app.indexOf('if session?.uid != oldValue?.uid'), app.indexOf('var pendingRidePayment'));
  for (const action of ['invalidateSearch()', 'searchPlaceRequests.removeAll()', 'searchOrigin = nil', 'searchDestination = nil']) {
    assert(reset.includes(action));
  }
  const wire = read(base + 'FirebaseBookingRequests.swift');
  assert(wire.indexOf('withCheckedThrowingContinuation') < wire.indexOf('let terms = try intent.terms.callablePayload()'));
  assert(wire.includes('"clientRequestId": requestId, "requesterUserId": uid'));
});

test('actual app state and new consent regressions are compiled without replacing original checks', () => {
  const runner = read('scripts/check-ios-native-plan.sh');
  assert.match(runner, /-swift-version 6/);
  for (const file of ['AppState.swift', 'AppState+Search.swift', 'SearchFormState.swift', 'SearchRequestState.swift', 'SearchConsentChecks.swift', 'SearchAppStateChecks.swift']) {
    assert(runner.includes(file), file);
  }
  const checks = read('ios/Tests/SportsGreenMooveNativeChecks/SearchConsentChecks.swift');
  for (const phrase of ['Another child requires new consent', 'A revoked response is ignored',
    'Old error cannot erase a newer search', 'Fresh consent for another child cannot reuse old results',
    'Another account cannot book the result', 'Another route cannot reuse the result']) assert(checks.includes(phrase));
  const ui = read('ios/UITests/SportsGreenMooveUITests/SearchConsentFlowTests.swift');
  assert.equal((ui.match(/func test\w+\(/g) ?? []).length, 2);
  assert.doesNotMatch(ui, /XCTSkip|continueAfterFailure\s*=|sleep\(/);
  assert.match(read('ios/UITests/SportsGreenMooveUITests/SportsGreenMooveUITests.swift'), /tapIdentifier\("search.consent", in: app\)/);
  const smoke = parseDocument(read('.github/workflows/web-integration-smoke.yml')).toJSON();
  assert(Object.values(smoke.jobs).some(job => job.steps.some(step => step.run?.includes('tests/ios-search-consent.test.mjs'))));
});

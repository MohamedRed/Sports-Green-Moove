import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {test} from 'node:test';
import {parseDocument} from 'yaml';
import {content} from '../partner-portal/content.mjs';
import {iosLocationShutdown, iosLocationShutdownProgress} from '../partner-portal/ios-location-shutdown.mjs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const app = 'ios/Sources/SportsGreenMooveApp/';
const folder = 'docs/release/evidence/ios-location-shutdown-2026-11-04/';
const sha = value => createHash('sha256').update(value).digest('hex');

test('stopped native work retains its completion handles and releases all waiters only after actual settlement', () => {
  const state = read(app + 'LocationSessionState.swift');
  assert.match(state, /var hasPendingWork: Bool \{ !pendingStarts.isEmpty \|\| !pendingUploads.isEmpty \}/);
  assert.match(state, /finishStart\(_ id: UUID\) \{ pendingStarts.remove\(id\); notifyIdle\(\) \}/);
  assert.match(state, /finishUpload\(_ id: UUID\) \{ pendingUploads.remove\(id\); notifyIdle\(\) \}/);
  assert.match(state, /guard !hasPendingWork else \{ return \}/);
  assert.match(state, /await withCheckedContinuation \{ idleWaiters.append\(\$0\) \}/);
  assert.match(state, /let completed = idleWaiters; idleWaiters.removeAll\(\)/);
  assert.match(state, /for waiter in completed \{ waiter.resume\(\) \}/);
  const provider = read(app + 'NativeLocationFallbackProvider.swift');
  assert.match(provider, /func awaitShutdown\(\) async \{ await state.waitUntilIdle\(\) \}/);
  assert.match(provider, /for task in uploads.values \{ task.cancel\(\) \}/);
  assert(provider.includes('defer { uploads.removeValue(forKey: uploadId) }'));
  assert(provider.includes('defer { state.finishUpload(work) }'));
  assert.doesNotMatch(provider, /uploads.removeAll\(\)/);
  const bridge = read(app + 'FirebaseNativeGateway.swift');
  assert(bridge.includes('NativeLocationFallbackProvider.shared.hasPendingWork'));
  assert(bridge.includes('await NativeLocationFallbackProvider.shared.awaitShutdown()'));
});

test('authentication and ride admission remain closed across a retained shutdown task', () => {
  const owner = read(app + 'AppState+LocationShutdown.swift');
  assert.match(owner, /guard firebase.nativeLocationWorkPending, nativeLocationShutdown == nil else \{ return \}/);
  assert(owner.indexOf('await firebase.awaitNativeLocationShutdown()') < owner.indexOf('nativeLocationShutdown = nil'));
  assert.doesNotMatch(owner, /catch|Task.sleep|retry|timeout|\.cancel\(/);
  const auth = read(app + 'AppState+Authentication.swift');
  assert(auth.includes('guard !rideRequests.busy, !accountWork.busy, !locationWorkUnsettled else { return }'));
  assert(auth.includes('session == nil && (rideRequests.busy || accountWork.busy || locationWorkUnsettled)'));
  const invalidation = read(app + 'RideRequestState.swift');
  assert(invalidation.indexOf('firebase.stopAllNativeLocationFallback()') < invalidation.indexOf('drainNativeLocationWork()'));
  assert(invalidation.includes('session.roles.contains(selectedRole), !locationWorkUnsettled'));
  for (const screen of ['HomeScreen', 'TripsScreen']) assert(read(app + screen + '.swift').includes('appState.tripActionBusy'));
  const permissions = read(app + 'ActiveRidePermissionGate.swift');
  assert.equal((permissions.match(/!rideRequests.busy, !locationWorkUnsettled/g) ?? []).length, 2);
});

test('the profile action is real and its additive UI case cannot replace or skip the original seven cases', () => {
  assert.match(read(app + 'ProfileScreen.swift'), /testID: UITestIdentifier.profileSignOutAction\) \{\s+appState.signOut\(\)/);
  const added = read('ios/UITests/SportsGreenMooveUITests/SignOutFlowTests.swift');
  for (const fragment of ['profile.sign-out.action', 'signOut.tap()', 'auth.screen', 'XCTAssertFalse', 'profile.name', 'auth.email.action']) assert(added.includes(fragment));
  assert.doesNotMatch(added, /XCTSkip|captureApproved|sleep\(|retry/);
  const suites = ['SportsGreenMooveUITests', 'SearchConsentFlowTests', 'SignOutFlowTests'];
  assert.equal(suites.reduce((sum, suite) => sum + [...read(`ios/UITests/SportsGreenMooveUITests/${suite}.swift`).matchAll(/func test\w+\(/g)].length, 0), 8);
});

test('the original admission failure and actual controlled checks stay separate from SDK, UI and physical acceptance', () => {
  const report = JSON.parse(read(iosLocationShutdown.source));
  const sources = JSON.parse(read(iosLocationShutdown.checksums));
  for (const item of sources.files) {
    const original = 'docs/release/evidence/source-archive/' + item.sha256 + '.txt';
    assert.equal(createHash('sha256').update(readFileSync(new URL('../' + original, import.meta.url))).digest('hex'), item.sha256, item.path);
  }
  assert.equal(report.baseline.sourceCommit, 'a226b3e265c78f58d56af892a666ae2778afc50b');
  assert.equal(report.baseline.signal, 'SIGTRAP'); assert.equal(report.baseline.authenticationCallsBeforeSettlement, 1);
  assert.equal(report.candidate.nativePlanExitCode, 0); assert.equal(report.candidate.providerCheckExitCode, 0);
  assert.equal(report.candidate.delayedStartUploadStates, 6); assert.equal(report.candidate.authenticationPathsBlocked, 5);
  assert.equal(report.candidate.continuousUploadsAwaited, 2); assert.equal(report.candidate.multipleWaiters, 2);
  assert.equal(report.candidate.totalRequiredUiCases, 8);
  for (const item of report.logs) assert.equal(sha(read(folder + item.file)), item.sha256);
  assert.match(read(folder + 'baseline-result.txt'), /authenticationCalls=1/);
  assert.match(read(folder + 'provider-result.txt'), /Controlled provider drain passed/);
  assert.match(read(folder + 'candidate-result.txt'), /LocationShutdownChecks passed: 6/);
  for (const key of ['sdkLinkedBuildAccepted', 'profileUiExecuted', 'fullSignOutAccepted', 'allSdkTransportsDrained',
    'physicalDeviceAccepted', 'newNativeMediaPublished', 'releaseComplete']) assert.equal(report[key], false);
  for (const key of ['providerRequests', 'productionWrites', 'realPayments', 'newPhoneSessions']) assert.equal(report[key], 0);
  const prior = JSON.parse(read('docs/release/evidence/automated-user-flow-evidence-2026-11-04.json'));
  const index = JSON.parse(read('docs/release/evidence/automated-user-flow-evidence-2026-11-04T-location-shutdown.json'));
  assert.equal(sha(read(index.inheritedEvidence.source)), index.inheritedEvidence.sha256);
  for (const item of prior.items) {
    const current = index.items.find(value => value.id === item.id);
    if (['ios_sdk_build_ci', 'ios_fixture_ui_ci'].includes(item.id)) {
      assert.equal(current.status, 'pending'); assert.deepEqual(current.previouslyPassedEvidence, item);
    } else assert.deepEqual(current, item);
  }
  assert.deepEqual(content.iosLocationShutdown, iosLocationShutdown);
  assert.deepEqual(content.updates.filter(item => item.source === iosLocationShutdownProgress.source), [iosLocationShutdownProgress]);
  assert.doesNotMatch(iosLocationShutdownProgress.title + iosLocationShutdownProgress.text, /Firebase|BrowserStack|SDK|Swift|CI\b/i);
});

test('web contracts and the complete iPhone workflow cover the changed source with unchanged runtime bounds', () => {
  const path = 'tests/ios-location-shutdown.test.mjs';
  const web = parseDocument(read('.github/workflows/web-integration-smoke.yml')).toJSON();
  for (const event of ['push', 'pull_request']) assert(web.on[event].paths.includes(path));
  assert(Object.values(web.jobs).some(job => job.steps.some(step => step.run?.includes(path))));
  const ios = parseDocument(read('.github/workflows/ios-mvp-verification.yml')).toJSON();
  assert(ios.on.pull_request.paths.includes(path));
  assert.equal(ios.jobs['ios-fixture-verification']['timeout-minutes'], 50);
  assert(read('scripts/check-ios-native-plan.sh').includes('LocationShutdownChecks.swift'));
  assert(read('scripts/qa/check-ios-location-provider.mjs').includes("resolve(fixture, 'DrainChecks.swift')"));
});

import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {parseDocument} from 'yaml';
import {createHash} from 'node:crypto';
import {content} from '../partner-portal/content.mjs';
import {iosAccountRefresh, iosAccountRefreshProgress} from '../partner-portal/ios-account-refresh.mjs';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const base = 'ios/Sources/SportsGreenMooveApp/';

test('account data is applied once, only after every currently owned read succeeds', () => {
  const state = read(base + 'AppState+Data.swift');
  const loader = read(base + 'AppDataGateway.swift');
  assert.match(state, /guard let uid = session\?\.uid, !uid\.isEmpty, !Task\.isCancelled else \{ return \}/);
  assert.match(state, /let role = selectedRole/);
  assert.match(state, /let requestId = UUID\(\)/);
  assert.match(state, /appDataRefreshId = requestId/);
  assert.match(state, /if appDataRefreshId == requestId \{ appDataRefreshId = nil \}/);
  assert.match(state, /try Task.checkCancellation\(\)/);
  assert.match(state, /appDataRefreshId == requestId, session\?\.uid == uid, selectedRole == role/);
  assert.match(state, /try await loadAppData\(from: firebase, role: role, requireCurrent: requireCurrent\)/);
  assert.match(state, /try requireCurrent\(\)\s+applyAppData\(snapshot\)/);
  assert.match(state, /guard !Task.isCancelled, appDataRefreshId == requestId, session\?\.uid == uid,/);
  assert.equal((state.match(/applyAppData\(snapshot\)/g) ?? []).length, 1);
  assert.equal((loader.match(/try requireCurrent\(\)/g) ?? []).length, 9);
  assert.equal((loader.match(/try await gateway\./g) ?? []).length, 8);
  assert.match(loader, /role == \.parent \? try await gateway.listChildren\(\) : \[\]/);
  assert.match(loader, /role == \.driver \? try await gateway.getDriverBookingRequests\(\) : \[\]/);
  assert.doesNotMatch(state + loader, /try\?|@unchecked|@preconcurrency|fallback|retry/i);
});

test('session and role transitions revoke work even when the same identity returns', () => {
  const state = read(base + 'AppState.swift');
  assert.match(state, /didSet \{ if selectedRole != oldValue \{ appDataRefreshId = nil \} \}/);
  assert.match(state, /if session\?\.uid != oldValue\?\.uid \{\s+appDataRefreshId = nil/);
  assert.doesNotMatch(state, /func refreshAppData\(/);
  assert.match(read(base + 'GatewayContracts.swift'), /protocol FirebaseGateway: AppDataGateway,/);
  assert.equal((read(base + 'PaymentsScreen.swift').match(/appState.refreshingAppData/g) ?? []).length, 2);
});

test('the actual app state executes race regressions in the ordinary Swift checks', () => {
  const checks = read('ios/Tests/SportsGreenMooveNativeChecks/AppDataRefreshChecks.swift');
  assert.match(checks, /for step in 1\.\.\.parentReads.count/);
  assert.match(checks, /app.signOut\(\)/);
  assert.match(checks, /returnToSameUid/);
  assert.match(checks, /roleState.selectedRole = \.driver\s+roleState.selectedRole = \.parent/);
  assert.match(checks, /for oldFails in \[false, true\]/);
  assert.match(checks, /cancelled.cancel\(\)/);
  assert.match(checks, /Current refresh changed another operation's busy state/);
  assert.match(checks, /An explicit new refresh could not recover/);
  assert.match(read('ios/Tests/SportsGreenMooveNativeChecks/main.swift'), /await checkAppDataRefresh\(\)/);
  const script = read('scripts/check-ios-native-plan.sh');
  for (const file of ['AppDataGateway.swift', 'AppState+Data.swift', 'AppDataProbe.swift', 'AppDataRefreshChecks.swift']) {
    assert(script.includes(file));
    const folder = file.includes('Checks') || file.includes('Probe') ? 'ios/Tests/SportsGreenMooveNativeChecks/' : base;
    assert(read(folder + file).split('\n').length < 300);
  }
});

test('both web events and the iPhone verifier include the new shared-data regressions', () => {
  const file = 'tests/ios-app-data.test.mjs';
  const native = parseDocument(read('.github/workflows/ios-mvp-verification.yml')).toJSON();
  assert(native.on.pull_request.paths.includes(file));
  const web = parseDocument(read('.github/workflows/web-integration-smoke.yml')).toJSON();
  for (const event of ['push', 'pull_request']) assert(web.on[event].paths.includes(file));
  assert(Object.values(web.jobs).some(job => job.steps.some(step => step.run?.includes(file))));
});

test('the before/after comparison remains local and never accepts session-exit UI or release readiness', () => {
  const report = JSON.parse(read(iosAccountRefresh.source));
  const folder = 'docs/release/evidence/ios-account-refresh-2026-11-04/';
  assert.equal(report.baseline.sourceCommit, '55822999ff5d31b792c71bd78b6ae0e59a743851');
  assert.equal(report.baseline.lateReadRestoredPrivateData, true);
  assert.equal(report.baseline.providerReadCount, 7);
  assert.equal(report.candidate.lateReadRestoredPrivateData, false);
  assert.equal(report.candidate.providerReadCount, 1);
  assert.equal(report.baseline.authenticated, false);
  assert.equal(report.candidate.authenticated, false);
  for (const proof of [report.reproduction, report.nativeChecks]) {
    assert.equal(proof.exitCode, 0);
    assert.equal(createHash('sha256').update(read(folder + proof.log)).digest('hex'), proof.logSha256);
  }
  assert.equal(report.nativeChecks.logoutReadBoundariesExercised, 7);
  assert.equal(report.nativeChecks.actualAppStateCompiled, true);
  const sources = JSON.parse(read(iosAccountRefresh.checksums));
  assert(Object.keys(sources).length >= 45);
  for (const hash of Object.values(sources)) assert.match(hash, /^[a-f0-9]{64}$/);
  assert(sources[base + 'AppState.swift'] && sources[base + 'AppState+Data.swift']);
  for (const key of ['sdkLinkedBuildAccepted', 'iosSessionExitUiAccepted', 'physicalDeviceEvidenceAccepted',
    'productionWrites', 'realPaymentExercised', 'newNativeMediaPublished', 'releaseComplete']) assert.equal(report[key], false);
  assert(report.remainingSessionExitWork.includes('tracking teardown'));
  assert(report.remainingSessionExitWork.includes('profile action'));
  assert.deepEqual(content.iosAccountRefresh, iosAccountRefresh);
  assert.deepEqual(content.updates.filter(item => item.source === iosAccountRefreshProgress.source), [iosAccountRefreshProgress]);
  assert.doesNotMatch(iosAccountRefreshProgress.title + iosAccountRefreshProgress.text,
    /Firebase|BrowserStack|Swift|SDK|backend|Xcode|CI\b/i);
});

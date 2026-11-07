import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {test} from 'node:test';
import {parseDocument} from 'yaml';
import {content} from '../partner-portal/content.mjs';
import {iosAuthentication, iosAuthenticationProgress} from '../partner-portal/ios-authentication.mjs';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const base = 'ios/Sources/SportsGreenMooveApp/';
const checks = 'ios/Tests/SportsGreenMooveNativeChecks/';
const folder = 'docs/release/evidence/ios-authentication-ownership-2026-11-04/';

test('authentication serializes provider identity mutations and cleans abandoned completions', () => {
  const gate = read(base + 'AuthenticationState.swift');
  assert.match(gate, /@Observable @MainActor/);
  assert.match(gate, /guard !busy, !Task.isCancelled else \{ return \.ignored \}/);
  assert.match(gate, /revision = id; pending = id/);
  assert.match(gate, /defer \{ if pending == id \{ pending = nil \} \}/);
  assert.match(gate, /policy.setRequiresSignOut\(true\)/);
  assert(gate.indexOf('policy.setRequiresSignOut(true)') < gate.indexOf('identity = try await action()'));
  assert.match(gate, /guard owns\(id\), !Task.isCancelled else/);
  assert.match(gate, /if changesIdentity \{ try policy.setRequiresSignOut\(false\) \}/);
  assert.match(gate, /cleanupRequired = !\(persisted && cleared\)/);
  assert.match(gate, /try gateway.signOut\(\); cleared = true/);
  assert.match(gate, /apply\(session\)\s+return \.applied\(id, session\)/);
  assert.doesNotMatch(gate, /try\?|Task.sleep|@unchecked|@preconcurrency/);
  const app = read(base + 'AppState+Authentication.swift');
  assert.match(app, /authentication.perform\(using: auth/);
  assert.match(app, /apply: \{ self.acceptInitializedSession\(\$0\) \}/);
  assert.match(app, /authentication.owns\(id\), accepted != nil, session == accepted/);
  assert.match(app, /let cleared = authentication.signOut\(using: auth\)/);
  assert.doesNotMatch(read(base + 'AppState.swift'), /func (signIn|signUp|signOut|authenticate|bootstrap)\(/);
  assert.match(read(base + 'GatewayContracts.swift'), /@MainActor func signOut\(\) throws/);
});

test('normal policy is durable and credential-free; UI fixtures inject an isolated policy', () => {
  const store = read(base + 'LogoutIntentStore.swift');
  assert.match(store, /private struct Record: Codable \{ let version: Int; let requiresSignOut: Bool \}/);
  assert.match(store, /catch CocoaError.fileReadNoSuchFile \{ return true \}/);
  assert.match(store, /guard record.version == 1 else \{ throw AuthenticationFailure.storage \}/);
  assert.match(store, /attributes.isExcludedFromBackup = true/);
  assert.match(store, /\[.atomic, .completeFileProtection\]/);
  assert.match(store, /try handle.synchronize\(\)/);
  assert.match(read(base + 'UITestAppStateFactory.swift'), /AuthenticationState\(makeStore: \{ UITestLogoutIntentStore\(\) \}\)/);
  const screen = read(base + 'AuthScreen.swift');
  assert.match(screen, /let submitted = \(mode: mode, name: name, email: email, password: password\)/);
  assert.match(screen, /\.disabled\(appState.authenticating\)/);
  assert.match(screen, /appState.authenticationCleanupRequired/);
  assert.match(screen, /appState.authenticationRestoreFailed/);
  assert.doesNotMatch(screen, /GoogleService-Info|Firebase/);
});

test('ordinary Swift checks execute ownership and persistence regressions against actual AppState', () => {
  const cases = read(checks + 'AuthenticationChecks.swift');
  for (const marker of ['["signIn", "signUp", "google", "facebook"]', 'pending.cancel()',
    'gateway.providerUid == nil', 'cleanupGateway.failSignOut = true', '["read", "write"]',
    'commitStore.failWrite = true', 'resume.authenticationRestoreFailed']) assert(cases.includes(marker));
  const entry = read(checks + 'main.swift');
  assert(entry.includes('await checkAuthenticationOwnership()'));
  assert(entry.includes('try await checkLogoutIntentPersistence()'));
  const script = read('scripts/check-ios-native-plan.sh');
  for (const file of ['AuthenticationState.swift', 'AppState+Authentication.swift', 'LogoutIntentStore.swift',
    'AuthenticationChecks.swift', 'AuthenticationProbe.swift', 'LogoutIntentChecks.swift']) {
    assert(script.includes(file));
    assert(read((file.endsWith('Checks.swift') || file.endsWith('Probe.swift') ? checks : base) + file).split('\n').length < 300);
  }
});

test('new authentication regressions trigger both web events and the iPhone gate', () => {
  const file = 'tests/ios-authentication.test.mjs';
  const ios = parseDocument(read('.github/workflows/ios-mvp-verification.yml')).toJSON();
  assert(ios.on.pull_request.paths.includes(file));
  const web = parseDocument(read('.github/workflows/web-integration-smoke.yml')).toJSON();
  for (const event of ['push', 'pull_request']) assert(web.on[event].paths.includes(file));
  assert(Object.values(web.jobs).some(job => job.steps.some(step => step.run?.includes(file))));
});

test('immutable local comparison does not accept real authentication, process death, UI or release', () => {
  const report = JSON.parse(read(iosAuthentication.source));
  assert.equal(report.baseline.sourceCommit, '91f9677b42ce0d6b9fdb537c244eb24208d78edb');
  assert.deepEqual(report.baseline.observed, {visibleSessionRestoredAfterLogout: true,
    simulatedProviderIdentityRemainedAfterLogout: true, providerSignOutCallCount: 1, laterPrivateReadCount: 7});
  assert.deepEqual(report.candidate.observed, {visibleSessionRestoredAfterLogout: false,
    simulatedProviderIdentityRemainedAfterLogout: false, providerSignOutCallCount: 2, laterPrivateReadCount: 0});
  for (const proof of [report.reproduction, report.nativeChecks]) {
    assert.equal(proof.exitCode, 0);
    assert.equal(createHash('sha256').update(read(folder + proof.log)).digest('hex'), proof.logSha256);
  }
  const hashes = JSON.parse(read(iosAuthentication.checksums));
  assert(Object.keys(hashes).length > 45);
  for (const value of Object.values(hashes)) assert.match(value, /^[a-f0-9]{64}$/);
  assert(hashes[base + 'AuthenticationState.swift']);
  assert.equal(report.missingPolicyRequiresExplicitSignIn, true);
  for (const field of ['sdkLinkedBuildAccepted', 'realProviderAuthenticationAccepted', 'nativeProcessDeathAccepted',
    'iosSessionExitUiAccepted', 'trackingTeardownAccepted', 'physicalDeviceEvidenceAccepted',
    'productionWrites', 'newNativeMediaPublished', 'releaseComplete']) assert.equal(report[field], false);
  assert.deepEqual(content.iosAuthentication, iosAuthentication);
  assert.deepEqual(content.updates.filter(item => item.source === iosAuthenticationProgress.source), [iosAuthenticationProgress]);
  assert.doesNotMatch(iosAuthenticationProgress.title + iosAuthenticationProgress.text,
    /Firebase|BrowserStack|Swift|SDK|backend|Xcode|CI\b/i);
});

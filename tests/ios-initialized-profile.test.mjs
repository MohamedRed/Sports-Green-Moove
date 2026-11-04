import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {test} from 'node:test';
import {parseDocument} from 'yaml';
import {content} from '../partner-portal/content.mjs';
import {iosProfileInitialization, iosProfileInitializationProgress} from '../partner-portal/ios-profile-initialization.mjs';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const base = 'ios/Sources/SportsGreenMooveApp/';
const folder = 'docs/release/evidence/ios-profile-initialization-2026-11-04/';

test('raw identity cannot open the account before its exact profile is prepared', () => {
  const gate = read(base + 'AuthenticationState.swift');
  const app = read(base + 'AppState+Authentication.swift');
  assert.match(gate, /action: @MainActor \(\) async throws -> AuthIdentity\?/);
  assert.match(gate, /prepare: @MainActor \(AuthIdentity\) async throws -> AuthSession/);
  assert(gate.indexOf('try await action()') < gate.indexOf('try await prepare(identity)'));
  assert(gate.indexOf('try await prepare(identity)') < gate.indexOf('policy.setRequiresSignOut(false)'));
  assert.match(gate, /initialized.isValid, initialized.uid == identity.uid/);
  assert(gate.indexOf('guard owns(id)', gate.indexOf('try await prepare(identity)')) < gate.indexOf('apply(session)'));
  assert.match(app, /firebase.initializeProfile\(identity: \$0, displayName: displayName\)/);
  assert.match(app, /\(2\.\.\.160\).contains\(submittedName.utf16.count\)/);
  assert.match(app, /authenticate\(displayName: submittedName\)/);
  assert.match(app, /!value.roles.contains\(selectedRole\)/);
});

test('production preparation validates exact UID, boolean flags and fresh claims without inferred roles', () => {
  const wire = read(base + 'AuthSession.swift');
  assert.match(wire, /JSONDecoder\(\).decode\(Payload.self/);
  assert.match(wire, /session.isValid, session.uid == expectedUid/);
  assert.match(wire, /Set\(decoded.roles.keys\) == Set\(AppRole.allCases.map/);
  assert.match(wire, /decoded.roles\[\$0.rawValue\] == session.roles.contains\(\$0\)/);
  assert.match(wire, /!roles.contains\(\.child\) \|\| roles == \[\.child\]/);
  const adapter = read(base + 'FirebaseInitializedProfile.swift');
  assert.match(adapter, /firebaseOwnedCall\(uid: identity.uid, name: "initializeUserProfile"/);
  assert.match(adapter, /user.getIDTokenResult\(forcingRefresh: true\)/);
  assert.match(adapter, /Set\(roles\) == Set\(session.roles\)/);
  assert.equal((adapter.match(/Task.checkCancellation\(\)/g) ?? []).length, 3);
  assert.doesNotMatch(wire + adapter, /try\?|@unchecked|@preconcurrency|roles = \[\.parent\]/);
  const signatures = read('scripts/check-ios-support-concurrency.sh');
  assert(signatures.includes('FirebaseInitializedProfile.swift'));
  assert(signatures.includes('-strict-concurrency=complete -warnings-as-errors'));
});

test('profile removes sample identity and only exposes authorized role changes', () => {
  const profile = read(base + 'ProfileScreen.swift');
  const identity = read(base + 'ProfileIdentity.swift');
  const home = read(base + 'HomeScreen.swift');
  assert.match(profile, /ForEach\(appState.session\?\.roles \?\? \[\]\)/);
  assert.match(profile, /selectAuthorizedRole\(role\)/);
  assert.match(read(base + 'AppState+Profile.swift'), /session.roles.contains\(role\), !authenticating/);
  assert.match(identity, /appState.session\?\.displayName/);
  assert.match(identity, /appState.session\?\.email/);
  assert.equal((identity.match(/\.fixedSize\(horizontal: false, vertical: true\)/g) ?? []).length, 3);
  assert.doesNotMatch(identity, /\.lineLimit\(3\)/);
  assert.match(home, /appState.session\?\.displayName/);
  assert.match(home, /TimelineView/);
  assert.doesNotMatch(profile + identity + home, /BAKOMBA|Olivier|U8 NATIONAUX|Mardi 07 Novembre 2022|Wavre, Belgique|"Activées"/);
});

test('the existing auth fixture now submits credentials and checks its actual synthetic profile', () => {
  const source = read('ios/UITests/SportsGreenMooveUITests/SportsGreenMooveUITests.swift');
  assert.match(source, /email.typeText\("parent@example.be"\)/);
  assert.match(source, /app.buttons\["auth.email.action"\].tap\(\)/);
  assert.match(source, /assertExists\("home.screen", in: app\)/);
  assert.match(source, /app.staticTexts\["profile.name"\].label, "Parent Démo"/);
  assert.match(source, /XCTAssertFalse\(app.buttons\["profile.role.child"\].exists\)/);
  assert.match(source, /XCTAssertFalse\(app.buttons\["profile.role.clubManager"\].exists\)/);
  const check = 'ios/Tests/SportsGreenMooveNativeChecks/ProfileInitializationChecks.swift';
  assert(read(check).includes('cancelled.cancel()'));
  assert(read(check).includes('names.isEmpty'));
  assert(read(check).includes('restoreRetry'));
  assert(read('scripts/check-ios-native-plan.sh').includes(check));
  assert(read('ios/Tests/SportsGreenMooveNativeChecks/main.swift').includes('try await checkProfileInitialization()'));
});

test('local preparation evidence never accepts real signup, rendered profile, teardown or release', () => {
  const report = JSON.parse(read(iosProfileInitialization.source));
  assert.equal(report.baseline.sourceCommit, 'a4fa494ac4fb29c41586b16d2896ae292721dcc3');
  for (const proof of [report.nativeChecks, report.signatureChecks]) {
    assert.equal(proof.exitCode, 0);
    assert.equal(createHash('sha256').update(read(folder + proof.log)).digest('hex'), proof.logSha256);
  }
  assert.equal(report.portalBrowser.initial.exitCode, 1);
  assert.equal(report.portalBrowser.initial.cause, 'not established');
  assert.equal(report.portalBrowser.recheck.exitCode, 0);
  assert.deepEqual(report.portalBrowser.recheck.viewports, [320, 390, 768, 1440]);
  assert.equal(report.portalBrowser.testsOrTimeoutsChanged, false);
  for (const proof of [report.portalBrowser.initial, report.portalBrowser.recheck]) {
    assert.equal(createHash('sha256').update(read(folder + proof.log)).digest('hex'), proof.logSha256);
  }
  const hashes = JSON.parse(read(iosProfileInitialization.checksums));
  for (const [file, hash] of Object.entries(hashes)) {
    assert.match(hash, /^[a-f0-9]{64}$/);
    if (file.endsWith('.swift')) assert(read(file).split('\n').length < 300 || file.includes('SGMIcons'));
  }
  for (const field of ['sdkLinkedBuildAccepted', 'realSignupAccepted', 'authProfileFixtureUiAccepted',
    'trackingTeardownAccepted', 'physicalDeviceEvidenceAccepted', 'productionWrites', 'newNativeMediaPublished', 'releaseComplete']) {
    assert.equal(report[field], false);
  }
  assert.deepEqual(content.iosProfileInitialization, iosProfileInitialization);
  assert.deepEqual(content.updates.filter(item => item.source === iosProfileInitializationProgress.source), [iosProfileInitializationProgress]);
  assert.doesNotMatch(iosProfileInitializationProgress.title + iosProfileInitializationProgress.text,
    /Firebase|BrowserStack|Swift|SDK|backend|Xcode|CI\b/i);
});

test('the new checks trigger both web events and the unchanged bounded iPhone workflow', () => {
  const path = 'tests/ios-initialized-profile.test.mjs';
  const ios = parseDocument(read('.github/workflows/ios-mvp-verification.yml')).toJSON();
  const web = parseDocument(read('.github/workflows/web-integration-smoke.yml')).toJSON();
  assert(ios.on.pull_request.paths.includes(path));
  for (const event of ['push', 'pull_request']) assert(web.on[event].paths.includes(path));
  assert(Object.values(web.jobs).some(job => job.steps.some(step => step.run?.includes(path))));
  assert.equal(ios.jobs['ios-fixture-verification']['timeout-minutes'], 35);
});

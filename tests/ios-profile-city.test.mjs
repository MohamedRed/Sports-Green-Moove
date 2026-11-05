import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {test} from 'node:test';
import {parseDocument} from 'yaml';
import {content} from '../partner-portal/content.mjs';
import {iosProfileCity, iosProfileCityProgress} from '../partner-portal/ios-profile-city.mjs';
import {partitionUpdates} from '../partner-portal/src/render.js';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const json = path => JSON.parse(read(path)), sha = bytes => createHash('sha256').update(bytes).digest('hex');
const app = 'ios/Sources/SportsGreenMooveApp/', folder = 'docs/release/evidence/ios-profile-city-2026-11-05/';
const report = json(iosProfileCity.source);
const frozen = (path, commit = 'candidate') => {
  const row = json(iosProfileCity.checksums).files.find(row => row.path === path && row.commit === commit);
  assert(row, path); const bytes = read('docs/release/evidence/source-archive/' + row.sha256 + '.txt');
  assert.equal(sha(bytes), row.sha256); return bytes;
};

test('profile city replaces the unrelated options route and preserves other modular settings', () => {
  const profile = read(app + 'ProfileScreen.swift'), settings = read(app + 'ProfileSettingsCard.swift');
  assert(profile.includes('ProfileSettingsCard()'));
  assert(settings.includes('ProfileCityEntry(access: access, gateway: appState.firebase).id(access.context.id)'));
  for (const value of ['"Mon club"', '"Paiements"', '"Notifications"', '"Paramètres"', 'clubSummaries.first(where: \\.isMember)']) assert(settings.includes(value));
  assert.doesNotMatch(profile + settings, /private struct ProfileSetting:|"Ma ville", "", AppOverlay.options/);
  assert(frozen(app + 'ProfileScreen.swift', report.baselineCommit).includes('"Ma ville", "", AppOverlay.options'));
  for (const path of ['SearchScreen.swift', 'AppState+Search.swift', 'PublishScreen.swift'])
    assert.doesNotMatch(read(app + path), /ProfileCity|profileCity|profileCities|cityGateway/);
});

test('city protocol uses exact ownership, safe revisions, canonical UTF16 bytes and stable nullable requests', () => {
  const source = read(app + 'ProfileCity.swift');
  for (const text of ['value.utf16.count <= 100', 'precomposedStringWithCanonicalMapping', 'normalized.utf16.elementsEqual(value.utf16)',
    'Set(data.keys) == ["userId", "city", "revision"]', 'CFGetTypeID(revision) != CFBooleanGetTypeID()',
    'userId == uid', 'number.isFinite', 'number.rounded() == number', 'ProfileCityWire.maximumRevision',
    'change.requestId.uuidString.lowercased()', '?? NSNull()', '"expectedRevision": change.expectedRevision']) assert(source.includes(text));
  assert.doesNotMatch(source, /UserDefaults|searchOrigin|latitude|longitude|collection\(/);
  assert.equal(source, frozen(app + 'ProfileCity.swift'));
});

test('city state owns callback drainage and retries only the immutable unresolved intent', () => {
  const state = read(app + 'ProfileCityState.swift');
  for (const text of ['access.begin()', 'access.finish(work)', 'access.owns(work)', 'generation == ticket',
    'inFlight += 1', 'inFlight -= 1', 'if let pending { change = pending }', 'pending = change; view = nil',
    'result.revision == change.expectedRevision + 1 && result.city == change.city', 'try result.validate(uid: access.context.uid)',
    'try accept(result)', 'view = nil; input = ""; pending = nil']) assert(state.includes(text));
  assert.doesNotMatch(state, /Task.sleep|while |repeat |UserDefaults|print\(|NSLog|catch.*return.*city/);
  assert.equal(state, frozen(app + 'ProfileCityState.swift'));
});

test('actual callable adapter constructs payloads at dispatch and returns only validated owned Sendable data', () => {
  const gateway = read(app + 'FirebaseProfileCityGateway.swift'), model = read(app + 'ProfileCity.swift');
  for (const text of ['request: ProfileCityRequest', 'let input = try request.payload()', 'httpsCallable(request.name).call(input)',
    'withCheckedThrowingContinuation', 'ProfileCityWire.parse(result?.data, uid: uid)', 'currentUser?.uid == uid']) assert(gateway.includes(text));
  for (const text of ['"getProfileCity"', '"saveProfileCity"']) assert(model.includes(text));
  assert.doesNotMatch(gateway, /collection\(|setData\(|updateData\(|try\?|setCustomUserClaims/);
  const fixture = read(app + 'UITestProfileCityGateway.swift');
  assert(fixture.includes('#if DEBUG')); assert(fixture.includes('change.expectedRevision == value.revision'));
  const signature = read('scripts/check-ios-support-concurrency.sh');
  for (const file of ['ProfileCity.swift', 'FirebaseProfileCityGateway.swift', 'UITestProfileCityGateway.swift']) assert(signature.includes(file));
});

test('separate executed native and backend proofs retain their exact scope and verified local cleanup', () => {
  assert.deepEqual(report.localChecks, {nativePlanExitCode: 0, signatureExitCode: 0, uiSyntaxExitCode: 0,
    persistedStates: 3, malformedRecords: 19, unsafeInputs: 9, malformedEnvelopes: 3, invalidWrites: 4, delayedBoundaries: 32, serviceGroups: 10});
  for (const record of report.records) assert.equal(sha(read(folder + record.file)), record.sha256);
  for (const row of json(iosProfileCity.checksums).files) assert.equal(sha(read('docs/release/evidence/source-archive/' + row.sha256 + '.txt')), row.sha256);
  assert.match(read(folder + 'native-result.txt'), /ProfileCityBoundaryChecks passed: 32/);
  assert.match(read(folder + 'native-result.txt'), /19 malformed\/foreign\/noncanonical records/);
  assert.match(read(folder + 'native-result.txt'), /SportsGreenMooveNativeChecks passed/);
  assert.match(read(folder + 'signature-result.txt'), /not an SDK build or phone test/);
  const service = json(folder + 'services.json'), cleanup = json(folder + 'cleanup-observation.json');
  assert.equal(service.checks.length, 10); assert(service.checks.every(row => row.status === 'passed'));
  assert(service.adminClientClosed && service.firestoreClientTerminated);
  assert(service.checks.some(row => row.id === 'no-search-trip-booking-role-claim-or-other-profile-side-effects'));
  for (const [path, hash] of Object.entries(service.sourceFiles)) assert.equal(sha(frozen(path)), hash);
  assert.equal(cleanup.ownedRuntimeAbsent, true); assert.equal(cleanup.endpoints.closed, true); assert.equal(cleanup.runnerExitCode, 0);
  assert.equal(service.nativeUiExecuted, false); assert.equal(service.providerRequests, 0); assert.equal(service.productionWrites, false);
});

test('city entry and editor render actual owned state, explicit retry/removal and captured discard actions', () => {
  const entry = read(app + 'ProfileCityEntry.swift'), editor = read(app + 'ProfileCityEditor.swift');
  for (const text of ['.accessibilityIdentifier("profile.city")', '.accessibilityValue(label)',
    'value.city ?? "Non renseignée"', 'state.resume()', 'ProfileCityEditor(access: access, gateway: gateway)']) assert(entry.includes(text));
  for (const text of ['TextField("Ville", text: $state.input)', 'state.pending == nil ? "Enregistrer" : "Réessayer"',
    'state.save(removing: true)', 'presenting: discard) { action in', '.disabled(state.busy || state.pending != nil)',
    '.interactiveDismissDisabled(state.dirty || state.busy || state.pending != nil)', '.fixedSize(horizontal: false, vertical: true)',
    'state.close()', 'state.suspend()']) assert(editor.includes(text));
  assert.doesNotMatch(entry + editor, /CLLocation|FirebaseAuth|UserDefaults|searchOrigin|AppOverlay.options|\.confirmationDialog/);
});

test('prepared city save/reopen/removal keeps eleven cases and exactly the original optional capture policy', () => {
  const path = 'ios/UITests/SportsGreenMooveUITests/';
  const cases = readdirSync(new URL('../' + path, import.meta.url)).filter(file => file.endsWith('.swift'))
    .flatMap(file => [...read(path + file).matchAll(/func (test\w+)\(/g)].map(match => match[1]));
  assert.equal(cases.length, 11); assert.equal(new Set(cases).size, 11);
  const helper = read(path + 'ProfileCityFlowChecks.swift'), main = read(path + 'SportsGreenMooveUITests.swift');
  for (const text of ['profile.city', 'city.input', 'city.save', 'city.remove', 'Ville enregistrée.', 'Ville supprimée.', 'Non renseignée']) assert(helper.includes(text));
  assert(main.indexOf('verifyProfileCity(in: app)') > main.indexOf('captureApproved(.profile, in: app)'));
  assert.doesNotMatch(helper, /XCTSkip|sleep\(|captureApproved|screenshot\(/);
  const current = parseDocument(read('.github/workflows/ios-mvp-verification.yml')).toJSON();
  const old = parseDocument(frozen('.github/workflows/ios-mvp-verification.yml', report.baselineCommit)).toJSON();
  assert.deepEqual(current.jobs, old.jobs); assert.deepEqual(current.concurrency, old.concurrency);
  assert.equal(current.jobs['ios-fixture-verification']['timeout-minutes'], 50);
});

test('one concise local-only note adds smoke coverage without promoting unexecuted native or release evidence', () => {
  assert.deepEqual(content.iosProfileCity, iosProfileCity);
  assert.deepEqual(content.updates.filter(row => row.source === iosProfileCityProgress.source), [iosProfileCityProgress]);
  assert(partitionUpdates(content.updates).previous.some(row => row.source === iosProfileCityProgress.source));
  assert.doesNotMatch(iosProfileCityProgress.title + iosProfileCityProgress.text, /Firebase|BrowserStack|SDK|Swift|CI\b/i);
  assert(report.profileOnly && report.stableUnknownWriteRetry && report.fixtureAssertionsPrepared); assert.equal(report.searchDefaultsChanged, false);
  for (const key of ['sdkLinkedBuildAccepted', 'fixtureUiExecuted', 'nativeServiceIntegrationAccepted', 'physicalDeviceAccepted',
    'newNativeMediaPublished', 'releaseComplete']) assert.equal(report[key], false);
  for (const key of ['providerRequests', 'productionWrites', 'realPayments', 'newPhoneSessions']) assert.equal(report[key], 0);
  const path = 'tests/ios-profile-city.test.mjs', web = parseDocument(read('.github/workflows/web-integration-smoke.yml')).toJSON();
  for (const event of ['pull_request', 'push']) assert(web.on[event].paths.includes(path));
  assert(Object.values(web.jobs).some(job => job.steps.some(step => step.run?.includes(path))));
  assert(Object.values(web.jobs).some(job => job.steps.some(step => step.run?.includes('node scripts/qa/run-profile-city-services.mjs'))));
  assert(parseDocument(read('.github/workflows/ios-mvp-verification.yml')).toJSON().on.pull_request.paths.includes(path));
  for (const id of ['ios_sdk_build_ci', 'ios_fixture_ui_ci'])
    assert.equal(json('docs/release/evidence-manifest.json').automatedUserFlowEvidence.items.find(row => row.id === id).status, 'pending');
});

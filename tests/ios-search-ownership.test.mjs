import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import test from 'node:test';
import {parseDocument} from 'yaml';
import {content} from '../partner-portal/content.mjs';
import {iosSearchOwnership, iosSearchOwnershipProgress} from '../partner-portal/ios-search-ownership.mjs';
import {iosA37FixturePass, iosA37FixturePassProgress} from '../partner-portal/ios-a37-fixture-pass.mjs';
import {iosSearchContractProgress} from '../partner-portal/ios-search-contract.mjs';
import {verificationFollowupProgress} from '../partner-portal/verification-followup.mjs';
import {partitionUpdates} from '../partner-portal/src/render.js';
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const json = path => JSON.parse(read(path));
const sha = value => createHash('sha256').update(value).digest('hex');
const app = 'ios/Sources/SportsGreenMooveApp/', dir = 'docs/release/evidence/ios-search-ownership-2026-11-05/';
const report = json(iosSearchOwnership.source);

test('the negative original search execution stays independently frozen rather than promoted by the correction', () => {
  const baseline = json(dir + 'baseline.json');
  assert.equal(baseline.sourceCommit, 'a37cdbf263642d2a9a26a0af3cf2b0363886bb97');
  assert.equal(baseline.result, 'not-accepted'); assert.equal(baseline.staleResponseRestorations, 22);
  assert.equal(baseline.callbacksMissingAccountLease, 24);
  assert.equal(sha(read(dir + baseline.resultFile)), baseline.resultSha256);
  for (const row of json(dir + 'baseline-source-sha256.json').files) assert.equal(sha(read('docs/release/evidence/source-archive/' + row.sha256 + '.txt')), row.sha256);
  assert(read(dir + baseline.resultFile).includes('22 stale/private response restorations, 24 unfinished callbacks without an account lease; not accepted'));
});
test('every search callback owns its full account/role/scene generation and retains real work until completion', () => {
  const activity = read(app + 'SearchActivityState.swift'), state = read(app + 'AppState+Search.swift');
  for (const part of ['let access: AccountAccess', 'let work: AccountWork', 'access.begin()', 'action.access.finish(action.work)',
    'revision == action.revision', 'action.access.owns(action.work)', 'pending[action.id] != nil', 'access.waitingForEarlierWork']) assert(activity.includes(part));
  assert(activity.includes('func suspend() { active = false; revision = UUID() }'));
  for (const part of ['searchActivity.begin(lane, access: access)', 'searchActivity.current(action)', 'searchActivity.finish(action)',
    'searchActivity.belongs(to: access)', 'displayed.contains(suggestion)', 'searchRequests.finish(request, owner: access.context',
    'searchPlaceRequests[target] == action.id']) assert(state.includes(part));
  assert.doesNotMatch(state, /session\?\.uid == uid|let uid = session|Task.sleep|try\? .*firebase/);
  assert(read(app + 'SearchRequestState.swift').includes('request.context.owner == owner'));
  const root = read(app + 'AppState.swift');
  assert(root.includes('resetSearchSession()\n        accountWork.replace(session: session, role: selectedRole)'));
  assert(root.includes('searchActivity.busy || searchRequests.pending != nil'));
  const screen = read(app + 'SearchScreen.swift');
  for (const part of ['let input = originInput', 'let input = destinationInput', 'access: access)',
    'appState.suspendSearch(access: access)', 'SearchSceneKey(phase: phase, waiting: access.waitingForEarlierWork)',
    '.disabled(!appState.searchActivity.available(.matches, access: access))']) assert(screen.includes(part));
});
test('shared SDK place and booking operations retain their caller instead of adopting another SDK user', () => {
  const places = read(app + 'FirebasePlacesGateway.swift'), booking = read(app + 'FirebaseOwnedBookingGateway.swift');
  assert.equal((places.match(/firebaseOwnedCall\(uid: uid/g) ?? []).length, 2);
  assert(booking.includes('guard !uid.isEmpty, Auth.auth().currentUser?.uid == uid'));
  assert(booking.includes('currentUid: { Auth.auth().currentUser?.uid == uid ? uid : nil }'));
  assert(booking.includes('firebaseOwnedCall(uid: uid, name: "approveBooking"'));
  const actions = read(app + 'AppState+Bookings.swift');
  assert(actions.includes('firebase.requestBooking(uid: access.context.uid, trip: trip, childId: childId, seats: seats)'));
  assert(actions.includes('firebase.approveBooking(uid: access.context.uid, bookingId: request.bookingId)'));
  assert.doesNotMatch(read(app + 'FirebaseNativeGateway.swift'), /func requestBooking\(/);
  assert.doesNotMatch(read(app + 'FirebaseBookingGateway.swift'), /func approveBooking\(/);
  const wire = read(app + 'PlaceSearchWire.swift');
  for (const part of ['CFGetTypeID(value) != CFBooleanGetTypeID()', 'value.doubleValue.isFinite',
    'Set(values.map(\\.placeId)).count == values.count', 'row["formattedAddress"]', 'guard (1...256).contains']) assert(wire.includes(part));
  assert.doesNotMatch(places + wire, /compactMap|\?\? "Adresse"|\?\? label|@preconcurrency|nonisolated\(unsafe\)/);
  const publish = read(app + 'PublishController.swift'), view = read(app + 'PublishScreen.swift');
  assert(publish.includes('firebase.suggestPlaces(uid: access.context.uid, input: input)'));
  assert(publish.includes('firebase.resolvePlace(uid: access.context.uid, placeId: suggestion.placeId)'));
  assert(view.includes('let input = from')); assert(view.includes('let input = to'));
});
test('executed controller/wire/adapter checks stay separate from new native and real-map acceptance', () => {
  for (const row of report.records) assert.equal(sha(read(dir + row.file)), row.sha256, row.file);
  for (const row of json(iosSearchOwnership.checksums).files) {
    assert.equal(sha(read('docs/release/evidence/source-archive/' + row.sha256 + '.txt')), row.sha256, row.path);
    if (row.path.endsWith('.swift')) assert(read(row.path).split('\n').length < 300, row.path);
  }
  const native = read(dir + 'native-result.txt');
  for (const part of ['SearchOwnershipChecks passed: 90', 'PlaceSearchWireChecks passed: 21', 'Publication ownership checks passed: 42',
    'Booking boundaries passed: 24', 'SportsGreenMooveNativeChecks passed', 'Membership fixture state passed: reject']) assert(native.includes(part));
  assert(read(dir + 'adapter-result.txt').includes('15 actual address/approval success/error/identity/cancellation cases and four pre-call denials'));
  assert(read(dir + 'booking-recovery-result.txt').includes('Booking recovery checks: 12 cases passed'));
  for (const key of ['currentSdkBuildAccepted', 'currentFixtureUiAccepted', 'nativeMapIntegrationAccepted', 'physicalDeviceAccepted', 'releaseComplete']) assert.equal(report[key], false);
  for (const key of ['productionWrites', 'providerRequests', 'newPhoneSessions', 'newMedia']) assert.equal(report[key], 0);
  const linux = json(dir + 'separate-linux-rules-validation.json');
  assert.equal(linux.head, 'a188fcadfb236e4f3a0114ef8d11bdfe9e15e078');
  assert.equal(linux.rules.flatMap(row => row.steps).find(row => row.name === 'Validate rules configuration without cloud changes').conclusion, 'success');
});
test('the complete earlier SDK/fixture pass accepts only its actual eleven-case source and zero-media scope', () => {
  const dir = 'docs/release/evidence/ios-fixture-pass-a37-2026-11-05/', proof = json(iosA37FixturePass.source);
  for (const row of proof.records) assert.equal(sha(read(dir + row.file)), row.sha256);
  for (const row of json(iosA37FixturePass.checksums).files) assert.equal(sha(read('docs/release/evidence/source-archive/' + row.sha256 + '.txt')), row.sha256);
  assert.equal(proof.runId, 42064566624); assert.equal(proof.sourceCommit, 'a37cdbf263642d2a9a26a0af3cf2b0363886bb97');
  const cases = json(dir + 'cases.json'); assert.equal(cases.length, 11); assert(cases.every(row => row.status === 'passed'));
  for (const name of ['testAuthFlowIdentifiers', 'testMessagesChatAndRatingIdentifiers', 'testSecondaryFlowIdentifiers', 'testActiveRideIdentifiers']) assert(cases.some(row => row.name === name));
  assert.equal(proof.sdkBuild, 'success'); assert.equal(proof.disposal, 'success'); assert.equal(proof.sourceFixtureGateAccepted, true);
  assert.equal(proof.artifactCount, 0); assert.equal(json(dir + 'artifacts.json').total_count, 0);
  for (const key of ['currentSearchCandidateAccepted', 'nativeServiceIntegrationAccepted', 'providerAuthenticationAccepted', 'physicalDeviceAccepted', 'releaseComplete']) assert.equal(proof[key], false);
});
test('second-child two-seat booking is added inside an original case without new cases, captures or limits', () => {
  const dir = 'ios/UITests/SportsGreenMooveUITests/';
  const cases = readdirSync(new URL('../' + dir, import.meta.url)).filter(path => path.endsWith('.swift'))
    .flatMap(path => [...read(dir + path).matchAll(/func test\w+\(/g)]);
  assert.equal(cases.length, 11);
  const helper = read(dir + 'OwnedSearchFlowChecks.swift');
  for (const part of ['search.child.child-2', 'booking.request.action', 'booking-child-2-2', 'Non accordé', 'Accordé']) assert(helper.includes(part));
  assert.doesNotMatch(helper, /screenshot|capture|sleep|XCTSkip|func test/);
  assert(read(dir + 'SearchConsentFlowTests.swift').includes('verifyOwnedChildBooking(in: app)'));
  assert(read(app + 'UITestAppStateFactory.swift').includes('_ = try bookingRequestPayload(trip: trip, childId: childId, seats: seats)'));
  const job = parseDocument(read('.github/workflows/ios-mvp-verification.yml')).toJSON().jobs['ios-fixture-verification'];
  assert.equal(job['timeout-minutes'], 50); assert.equal(job.steps.filter(step => step.uses?.startsWith('actions/upload-artifact')).length, 1);
  assert(read('scripts/check-ios-native-plan.sh').includes('scripts/qa/check-ios-owned-places.sh'));
});
test('two concise scoped notes preserve old portal records and current release gaps with complete workflow coverage', () => {
  const previous = json(dir + 'portal-before.json');
  for (const row of previous.flows) assert.equal(sha(JSON.stringify(content.flows.find(flow => flow.id === row.id))), row.sha256);
  for (const hash of previous.updates) assert(content.updates.some(row => sha(JSON.stringify(row)) === hash));
  assert.equal(sha(JSON.stringify(content.blockers)), previous.blockers);
  for (const [key, descriptor, progress] of [['iosSearchOwnership', iosSearchOwnership, iosSearchOwnershipProgress], ['iosA37FixturePass', iosA37FixturePass, iosA37FixturePassProgress]]) {
    assert.deepEqual(content[key], descriptor); assert.deepEqual(content.updates.filter(row => row.source === progress.source), [progress]);
    assert.doesNotMatch(progress.title + progress.text, /Firebase|BrowserStack|Swift|SDK|Xcode|CI\b/i);
    const partition = partitionUpdates(content.updates);
    if (key === 'iosSearchOwnership') {
      assert(partition.previous.some(row => row.source === progress.source));
      assert(partition.previous.some(row => row.source === iosSearchContractProgress.source && row.flow === progress.flow));
      assert(partition.recent.some(row => row.source === verificationFollowupProgress.source && row.flow === progress.flow));
    } else assert(partition.recent.some(row => row.source === progress.source));
  }
  const previousUpdates = partitionUpdates(content.updates).previous;
  for (const source of ['ios-membership-2026-11-05/README.md', 'ios-preparation-timeout-a226-2026-11-04/README.md']) {
    assert(previousUpdates.some(row => row.source.endsWith(source)));
  }
  for (const name of ['web-integration-smoke', 'ios-mvp-verification']) {
    const workflow = parseDocument(read('.github/workflows/' + name + '.yml')).toJSON();
    assert(workflow.on.pull_request.paths.includes('tests/ios-search-ownership.test.mjs'));
    if (name === 'web-integration-smoke') {
      assert(workflow.on.push.paths.includes('tests/ios-search-ownership.test.mjs'));
      assert(Object.values(workflow.jobs).some(job => job.steps.some(step => step.run?.includes('tests/ios-search-ownership.test.mjs'))));
    }
  }
  for (const id of ['ios_sdk_build_ci', 'ios_fixture_ui_ci']) assert.equal(json('docs/release/evidence-manifest.json').automatedUserFlowEvidence.items.find(row => row.id === id).status, 'pending');
});

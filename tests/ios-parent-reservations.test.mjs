import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync, readdirSync} from 'node:fs';
import test from 'node:test';
import {parseDocument} from 'yaml';
import {content} from '../partner-portal/content.mjs';
import {iosParentReservations, iosParentReservationsProgress} from '../partner-portal/ios-parent-reservations.mjs';
import {withParentReservationChecks} from '../scripts/qa/ios-reservation-fixture-extension.mjs';
import {iosAutomatedEvidenceIds, assertCurrentIosAutomatedEvidence} from '../scripts/qa/ios-fixture-release-evidence.mjs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const json = path => JSON.parse(read(path)), sha = value => createHash('sha256').update(value).digest('hex');
const app = 'ios/Sources/SportsGreenMooveApp/', folder = 'docs/release/evidence/ios-parent-reservations-2026-11-06/';
test('the parent tab uses owned reservations while retaining the independent driver trip branch', () => {
  const sources = json(folder + 'source-sha256.json').files;
  const before = sources.find(row => row.path === app + 'TripsScreen.swift' && row.commit !== 'candidate');
  const original = read('docs/release/evidence/source-archive/' + before.sha256 + '.txt');
  assert(original.includes('ForEach(visibleTrips)')); assert(!original.includes('ParentReservationsScreen'));
  const current = read(app + 'TripsScreen.swift');
  assert(current.includes('if access.context.role == .parent')); assert(current.includes('ParentReservationsScreen(access: access, gateway: appState.firebase).id(access.context.id)'));
  assert(current.includes('ForEach(visibleTrips)')); assert(current.includes('BookingRequestsList(access: access'));
  const gateway = read(app + 'FirebaseParentReservations.swift');
  assert(gateway.includes('var input: [String: String] = ["role": "parent"]'));
  for (const name of ['listReservations', 'cancelBooking']) assert(gateway.includes('name: "' + name + '"'));
  assert.equal((gateway.match(/firebaseOwnedCall\(uid: uid/g) ?? []).length, 2);
  assert.doesNotMatch(gateway, /collection\(|setCustomUserClaims|retry|createPayment/);
});
test('actual checked source binds controlled state, strict signatures and real scripted adapter execution', () => {
  const report = json(iosParentReservations.source); assert.equal(sha(read(iosParentReservations.source)), iosParentReservations.sha256);
  for (const row of report.records) assert.equal(sha(read(folder + row.file)), row.sha256);
  for (const row of json(folder + 'source-sha256.json').files) assert.equal(sha(read('docs/release/evidence/source-archive/' + row.sha256 + '.txt')), row.sha256);
  assert.deepEqual([report.malformedResponsesRejected, report.delayedStateBoundaries, report.pagingRejections,
    report.deniedNonParentRoles, report.actualAdapterCallbacks, report.adapterPreCallDenials], [21, 12, 4, 3, 12, 5]);
  assert.equal(report.nativePlanExitCode, 0); assert.equal(report.signaturesExitCode, 0);
  for (const key of ['sdkLinkedBuildAccepted', 'nativeScreenExecuted', 'liveBackendMutationAccepted', 'refundSettled', 'physicalDeviceAccepted', 'releaseComplete']) assert.equal(report[key], false);
  assert.match(read(folder + 'native-checks.txt'), /ParentReservationAdapterChecks passed: 12/);
  assert.match(read(folder + 'signature-checks.txt'), /Owned callable signature checks passed/);
});
test('both pending iPhone records retain every previous proof and all unrelated requirements', () => {
  const before = json(folder + 'manifest-before.json'), after = json(folder + 'manifest-after.json');
  for (const key of Object.keys(before).filter(key => key !== 'automatedUserFlowEvidence')) assert.deepEqual(after[key], before[key]);
  for (const old of before.automatedUserFlowEvidence.items) {
    const row = after.automatedUserFlowEvidence.items.find(item => item.id === old.id);
    if (iosAutomatedEvidenceIds.includes(old.id)) { assert.equal(row.status, 'pending'); assert.deepEqual({...row, description: old.description}, old); }
    else assert.deepEqual(row, old);
  }
  assertCurrentIosAutomatedEvidence();
});
test('the original booking fixture only adds the parent sequence and retains eleven cases and the approved deadline', () => {
  const path = 'ios/UITests/SportsGreenMooveUITests/SportsGreenMooveUITests.swift';
  const row = json('docs/release/evidence/ios-reward-navigation-2026-11-06/source-sha256.json').files.find(row => row.path === path && row.commit === 'candidate');
  assert.equal(read(path), withParentReservationChecks(read('docs/release/evidence/source-archive/' + row.sha256 + '.txt')));
  const directory = 'ios/UITests/SportsGreenMooveUITests/';
  assert.equal(readdirSync(new URL('../' + directory, import.meta.url)).filter(name => name.endsWith('.swift'))
    .flatMap(name => [...read(directory + name).matchAll(/func (test\w+)\(/g)]).length, 11);
  const workflow = parseDocument(read('.github/workflows/ios-mvp-verification.yml')).toJSON();
  assert.equal(workflow.jobs['ios-fixture-verification']['timeout-minutes'], 50);
  assert.equal(workflow.on.workflow_dispatch.inputs.retain_approved_captures.default, false);
  const fixture = read(directory + 'ParentReservationFlowChecks.swift');
  for (const id of ['reservations.more', 'reservations.cancel.confirm', 'reservations.confirmed', 'reservations.resolve']) assert(fixture.includes(id));
  assert.doesNotMatch(fixture, /XCTSkip|sleep\(|captureApproved|screenshot/);
});
test('public progress remains local-only with the historical iPhone and Android results intact', () => {
  assert.deepEqual(content.iosParentReservations, iosParentReservations);
  assert(content.updates.some(row => row.source === iosParentReservationsProgress.source));
  assert.match(iosParentReservationsProgress.text, /contrôles locaux/); assert.match(iosParentReservationsProgress.text, /reste à faire/);
  assert.doesNotMatch(iosParentReservationsProgress.text + iosParentReservationsProgress.title, /Firebase|BrowserStack|SDK|Swift|CI\b/);
  for (const name of ['ios-reward-navigation-2026-11-06', 'ios-fixture-gate-d3c0f7a', 'native-matrix-115fee1'])
    assert(content.updates.some(row => row.source.includes(name)));
  assert.equal(content.flows.length, 34);
});

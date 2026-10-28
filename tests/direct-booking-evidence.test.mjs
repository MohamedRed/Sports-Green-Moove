import assert from 'node:assert/strict';
import {cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import test from 'node:test';
import {assertDirectBookingEvidence, validateDirectBookingEvidence, directBookingEvidenceDirectory as folder} from '../scripts/qa/direct-booking-evidence.mjs';
import {directBookingPhonePhases} from '../scripts/qa/direct-booking-phone-checkpoints.mjs';
import {content, captures} from '../partner-portal/content.mjs';

const root = resolve(import.meta.dirname, '..'), read = path => readFileSync(resolve(root, path), 'utf8');
const json = name => JSON.parse(read(folder + '/' + name + '.json'));
const reports = () => ({summary: json('summary'), session: json('phone/checkpoints/session-results'), baseline: json('phone/checkpoints/baseline'),
  checkpoints: directBookingPhonePhases.map(phase => json('phone/checkpoints/' + phase)), observations: json('phone/ui-observations'),
  cleanup: json('phone/runtime-disposal'), runtime: json('phone/runtime/runtime-cleanup'), captures: json('public-captures'),
  approval: json('session-capture-approval')});

test('the original three-call regression and corrected unit/phone proof stay scoped and independently retained', () => {
  const run = validateDirectBookingEvidence(root);
  assert.equal(run.completedCheckpoints, 8); assert.equal(run.nativeComponentTestsExecuted, false);
});
test('subsequent component execution stays separate from the original phone record and failed web check', () => {
  const ci = json('component-ci/summary');
  assert.equal(ci.nativeCiPassed, true); assert.equal(ci.directBookingCasesPassed, 2);
  assert.equal(ci.overallPrChecksPassed, false); assert.equal(ci.physicalResponseLossVerified, false);
  assert.match(read(folder + '/composition-recheck/gradle.txt'), /BUILD SUCCESSFUL/);
});
test('duplicates, altered capacity, replacement receipts and changes to unrelated records invalidate the phone proof', () => {
  for (const mutate of [
    r => r.checkpoints[3].state.documents.bookings.push(r.checkpoints[3].state.documents.bookings.at(-1)),
    r => r.checkpoints[3].state.documents.trips[0].data.seatsAvailable--,
    r => r.checkpoints[3].state.documents.bookingRequestReceipts.at(-1).data.response.bookingId = 'replacement',
    r => r.checkpoints[0].state.claims[0].claims = {roleKeys: ['admin']},
    r => r.checkpoints[7].state.documents.bookings.at(-1).data.status = 'cancelled',
  ]) { const r = reports(); mutate(r); assert.throws(() => assertDirectBookingEvidence(r)); }
});
test('pending removal, stale process measurements and broader search, payment or release claims are rejected', () => {
  for (const mutate of [
    r => r.observations.find(x => x.phase === 'process-stopped').processAbsent = false,
    r => r.observations.find(x => x.phase === 'process-after-restart').pid = 28390,
    r => r.observations.find(x => x.phase === 'package-absent').independentlyObserved = false,
    r => r.cleanup.helperDirectoryAbsent = false,
    r => r.summary.searchScreenRestartVerified = true,
    r => r.summary.nativeComponentTestsExecuted = true,
    r => r.summary.installedBytesIndependentlyVerified = true,
    r => r.summary.productionDeployed = true,
    r => r.summary.releaseComplete = true,
    r => r.captures[0].method = 'native-export',
    r => r.approval.approved = false,
  ]) { const r = reports(); mutate(r); assert.throws(() => assertDirectBookingEvidence(r)); }
});
test('changing original context pixels fails even if the published crops are untouched', () => {
  const temp = mkdtempSync(resolve(tmpdir(), 'sgm-direct-booking-evidence-'));
  try {
    cpSync(resolve(root, folder), resolve(temp, folder), {recursive: true});
    writeFileSync(resolve(temp, folder, 'phone/restarted-context.png'), 'changed');
    assert.throws(() => validateDirectBookingEvidence(temp));
  } finally { rmSync(temp, {recursive: true, force: true}); }
});
test('both parent shortcuts use explicit account-owned confirmation rather than an immediate gateway write', () => {
  const prefix = 'android/app/src/main/java/be/sportgreenmoove/app/ui/';
  const actions = read(prefix + 'SportsGreenMooveRideActions.kt'), app = read(prefix + 'SportsGreenMooveApp.kt');
  assert(actions.includes('onParentBooking(trip)')); assert(!actions.includes('requestBooking('));
  assert(app.includes('onParentBooking = directBooking::open')); assert(app.includes('directBooking.close()'));
  assert(app.includes('onTripAction = ::runTripAction')); assert(app.includes('AppScreen.Home -> HomeRoute('));
  assert(read(prefix + 'HomeRoute.kt').includes('?.let(onTripAction)'));
  for (const file of ['SportsGreenMooveApp.kt', 'DirectBookingDialog.kt', 'DirectBookingState.kt']) assert(read(prefix + file).split('\n').length < 301);
});
test('the current short tour uses four dated session captures and preserves the earlier two-seat phone gallery', () => {
  const flow = content.flows.find(row => row.id === 'booking');
  assert.equal(flow.status, 'partial'); assert.equal(flow.checkedAt, '2026-10-28'); assert.equal(flow.tour.length, 4);
  assert.equal(flow.directBookingPhone.source, folder + '/summary.json');
  for (const image of flow.images.slice(0, 4)) {
    assert.match(image.alt, /capture de session du 28 octobre/); assert(captures[image.file].startsWith(folder + '/captures/'));
  }
  assert.equal(flow.searchBookingPhone.checkedAt, '2026-10-24');
  assert.equal(flow.images.filter(row => row.file.startsWith('search-phone-')).length, 5);
  assert.match(flow.remaining, /réponses perdues.*recherche/); assert.match(flow.remaining, /deux téléphones/);
  assert.doesNotMatch(JSON.stringify(flow), /BrowserStack|Firebase|SDK|Kotlin|Pixel/);
});

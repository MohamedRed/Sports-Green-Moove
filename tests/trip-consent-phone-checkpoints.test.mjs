import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {tripConsentPhonePhases, verifyTripConsentPhoneState} from '../scripts/qa/trip-consent-phone-checkpoints.mjs';

function sample(phase) {
  const fixtures = {}, parentUids = ['p1', 'p2'], stage = tripConsentPhonePhases.indexOf(phase);
  const baseline = {documents: {trips: [], bookings: [], users: ['d', ...parentUids].map(id => ({id, data: {name: id, updatedAt: 1}})),
    protected: [{id: 'foreign', data: {unchanged: true}}]}, claims: [{uid: 'd', claims: {driver: true}}], liveTrips: {foreign: {point: 1}}};
  for (const kind of ['confirmed', 'declined', 'withdrawn']) {
    const before = {priceCents: 250, departureAt: '2099-01-01T10:00:00Z', arrivalBy: null,
      origin: {lat: 50, lng: 4}, destination: {lat: 51, lng: 5}, seatsAvailable: 2};
    const bookingIds = parentUids.map(uid => kind + '-' + uid), bookingsBefore = parentUids.map(parentUserId => ({status: 'approved', parentUserId}));
    fixtures[kind] = {tripId: kind, before, bookingIds, bookingsBefore};
    baseline.documents.trips.push({id: kind, data: {...before, updatedAt: 1}});
    bookingIds.forEach((id, index) => baseline.documents.bookings.push({id, data: bookingsBefore[index]}));
  }
  const fixture = {fixtures, parentUids, driverUid: 'd'}, state = structuredClone(baseline);
  state.documents.tripChanges = []; state.documents.notifications = [];
  const expected = {confirmed: stage < 3 ? null : stage < 5 ? 'pending' : 'confirmed',
    declined: stage < 6 ? null : stage < 7 ? 'pending' : 'declined', withdrawn: stage < 8 ? null : stage < 9 ? 'pending' : 'withdrawn'};
  for (const [kind, status] of Object.entries(expected)) {
    if (!status) continue;
    const id = kind + '-proposal', originalTerms = fixtures[kind].before;
    const count = kind === 'confirmed' ? stage === 3 ? 0 : stage === 4 ? 1 : 2 : kind === 'declined' && stage >= 7 ? 1 : 0;
    const decisions = Object.fromEntries(parentUids.slice(0, count).map(uid => [uid, {decision: kind === 'declined' ? 'decline' : 'accept'}]));
    state.documents.tripChanges.push({id, data: {tripId: kind, status, originalTerms, terms: {...originalTerms, priceCents: 400},
      parentUserIds: parentUids, bookingIds: fixtures[kind].bookingIds, decisions}});
    const terminal = status !== 'pending';
    state.documents.notifications.push(...parentUids.map(uid => ({id: id + '-proposed-' + uid,
      data: {type: 'tripChange', sourceId: kind, proposalId: id, userId: uid}})));
    if (terminal) state.documents.notifications.push(...['d', ...parentUids].map(uid => ({id: id + '-final-' + uid,
      data: {type: 'tripChange', sourceId: kind, proposalId: id, userId: uid}})));
    const trip = state.documents.trips.find(row => row.id === kind);
    if (!['declined', 'withdrawn'].includes(status)) trip.data.pendingChangeId = id;
    trip.data.updatedAt = 2;
  }
  return {fixture, state, baseline};
}

for (const phase of tripConsentPhonePhases) test('independent consent observer accepts only its scoped stage: ' + phase, () => {
  const {fixture, state, baseline} = sample(phase);
  const result = verifyTripConsentPhoneState(phase, fixture, state, baseline);
  assert.equal(result.phase, phase); assert.equal(result.phoneUiProven, false); assert.equal(result.applicationExercised, false);
});
for (const [label, mutate] of [
  ['prematurely applied trip', s => {s.documents.trips[0].data.priceCents = 400;}],
  ['changed booking', s => {s.documents.bookings[0].data.status = 'cancelled';}],
  ['first parent approval attributed to the other parent', s => {s.documents.tripChanges[0].data.decisions = {p2: {decision: 'accept'}};}],
  ['missing parent decision', s => {s.documents.tripChanges[0].data.decisions = {};}],
  ['third party decision', s => {s.documents.tripChanges[0].data.decisions = {outsider: {decision: 'accept'}};}],
  ['unexpected route edit', s => {s.documents.tripChanges[0].data.terms.origin.lat = 0;}],
  ['missing notification', s => {s.documents.notifications.pop();}],
  ['duplicate notification', s => {s.documents.notifications.push(s.documents.notifications[0]);}],
  ['changed foreign record', s => {s.documents.protected[0].data.unchanged = false;}],
  ['changed claims', s => {s.claims[0].claims.admin = true;}],
  ['changed live trip', s => {s.liveTrips.foreign.point = 2;}],
  ['unexpected new payment', s => {s.documents.payments = [{id: 'unexpected', data: {amount: 400}}];}],
]) test('independent consent observer rejects ' + label, () => {
  const {fixture, state, baseline} = sample('first-parent-accepted'); mutate(state);
  assert.throws(() => verifyTripConsentPhoneState('first-parent-accepted', fixture, state, baseline));
});
test('a private draft cannot create a stored proposal', () => {
  const {fixture, state, baseline} = sample('proposed');
  assert.throws(() => verifyTripConsentPhoneState('draft-private', fixture, state, baseline));
});
test('read-only observer never proposes, decides, quotes, applies or pays after fixture setup', () => {
  const source = readFileSync(new URL('../scripts/qa/manual-trip-consent-phone-session.mjs', import.meta.url), 'utf8');
  const observer = source.slice(source.indexOf('for await (const line'));
  assert.doesNotMatch(observer, /call\(['"](?:proposeTripChanges|respondToTripChanges|withdrawTripChanges|getTripChangeApplicationQuote|applyTripChanges|createRidePaymentIntent)/);
  assert.match(source, /withLocalAdminCleanup/); assert.match(source, /await db\.terminate\(\)/);
  assert.match(source, /phoneUiProven: false/); assert.match(source, /wholeProcessRestartProven: false/);
});

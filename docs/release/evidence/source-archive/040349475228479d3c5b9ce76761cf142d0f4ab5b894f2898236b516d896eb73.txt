import assert from 'node:assert/strict';

export function assertTripConsentPhoneSession(session) {
  assert(session?.projectId === 'demo-sgm-local-qa', 'Consent trial requires the isolated project');
  assert(typeof session.runId === 'string' && /^[a-f0-9]{32}$/.test(session.runId), 'Consent trial requires a valid run ID');
  assert(typeof session.password === 'string' && session.password.length >= 12, 'Consent trial requires an ephemeral password');
  for (const [role, email] of Object.entries({driver: 'd@example.test', parent: 'p@example.test', outsider: 'outsider@example.test'}))
    assert(session[role] === email, `Consent trial requires the ${role} account from start-local-ui.mjs`);
}

export const tripConsentPhonePhases = ['prepared', 'draft-private', 'draft-returned', 'proposed',
  'first-parent-accepted', 'both-parents-accepted', 'decline-proposed', 'declined', 'withdrawal-proposed', 'withdrawn'];
const cleanTrip = data => Object.fromEntries(Object.entries(data).filter(([key]) => !['pendingChangeId', 'updatedAt'].includes(key)));

export function verifyTripConsentPhoneState(phase, fixture, state, baseline) {
  const stage = tripConsentPhonePhases.indexOf(phase); assert(stage >= 0);
  const expectation = {
    confirmed: stage < 3 ? null : stage < 5 ? 'pending' : 'confirmed',
    declined: stage < 6 ? null : stage < 7 ? 'pending' : 'declined',
    withdrawn: stage < 8 ? null : stage < 9 ? 'pending' : 'withdrawn',
  };
  const ownTripIds = Object.values(fixture.fixtures).map(row => row.tripId);
  const changes = state.documents.tripChanges ?? [], notices = state.documents.notifications ?? [];
  const ownChangeIds = [];
  for (const [kind, row] of Object.entries(fixture.fixtures)) {
    const trip = state.documents.trips.find(item => item.id === row.tripId)?.data; assert(trip);
    assert.deepEqual(cleanTrip(trip), row.before, 'Consent alone must not apply the proposed details');
    for (const [index, id] of row.bookingIds.entries())
      assert.deepEqual(state.documents.bookings.find(item => item.id === id)?.data, row.bookingsBefore[index]);
    const found = changes.filter(item => item.data.tripId === row.tripId);
    assert.equal(found.length, Number(expectation[kind] !== null));
    if (!found.length) { assert.equal(trip.pendingChangeId, undefined); continue; }
    const {id, data: change} = found[0]; ownChangeIds.push(id);
    assert.equal(change.status, expectation[kind]); assert.equal(change.originalTerms.priceCents, 250);
    assert.equal(change.terms.priceCents, 400);
    assert.deepEqual(change.terms, {...change.originalTerms, priceCents: 400});
    assert.deepEqual([...change.parentUserIds].sort(), fixture.parentUids.slice().sort());
    assert.deepEqual(change.bookingIds.slice().sort(), row.bookingIds.slice().sort());
    const decisions = Object.entries(change.decisions);
    const count = kind === 'confirmed' ? (stage === 3 ? 0 : stage === 4 ? 1 : 2)
      : kind === 'declined' && stage >= 7 ? 1 : 0;
    assert.equal(decisions.length, count);
    for (const [uid, decision] of decisions) {
      assert(fixture.parentUids.includes(uid)); assert.equal(decision.decision, kind === 'declined' ? 'decline' : 'accept');
    }
    if (kind === 'confirmed' && stage === 4) assert.equal(decisions[0][0], fixture.parentUids[0]);
    assert.equal(trip.pendingChangeId, ['declined', 'withdrawn'].includes(change.status) ? undefined : id);
    const notes = notices.filter(item => item.data.proposalId === id);
    const terminal = ['confirmed', 'declined', 'withdrawn'].includes(change.status);
    assert.equal(notes.length, terminal ? 5 : 2);
    assert.equal(new Set(notes.map(item => item.id)).size, notes.length);
    assert(notes.every(item => item.data.type === 'tripChange' && item.data.sourceId === row.tripId));
    for (const uid of fixture.parentUids) assert.equal(notes.filter(item => item.data.userId === uid).length, terminal ? 2 : 1);
    assert.equal(notes.filter(item => item.data.userId === fixture.driverUid).length, Number(terminal));
  }
  const after = structuredClone(state), before = structuredClone(baseline);
  for (const value of [before, after]) {
    for (const row of value.documents.trips) if (ownTripIds.includes(row.id)) row.data = cleanTrip(row.data);
    for (const uid of [fixture.driverUid, ...fixture.parentUids]) {
      const user = value.documents.users.find(row => row.id === uid); if (user) delete user.data.updatedAt;
    }
    value.documents.tripChanges = (value.documents.tripChanges ?? []).filter(row => !ownChangeIds.includes(row.id));
    value.documents.notifications = (value.documents.notifications ?? []).filter(row => !ownChangeIds.includes(row.data.proposalId));
    for (const [name, rows] of Object.entries(value.documents)) if (!rows.length) delete value.documents[name];
  }
  assert.deepEqual(after, before, 'Unrelated documents, all claims and live trips must remain unchanged');
  return {phase, proposalCount: ownChangeIds.length, allBookingsUnchanged: true, tripTermsUnchanged: true,
    unrelatedRecordsUnchanged: true, allClaimsUnchanged: true, liveTripsUnchanged: true,
    applicationExercised: false, routeProviderExercised: false, paymentExercised: false, phoneUiProven: false};
}

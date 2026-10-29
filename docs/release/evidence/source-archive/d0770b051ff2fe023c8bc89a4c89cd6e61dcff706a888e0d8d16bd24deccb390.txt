import assert from 'node:assert/strict';
import {db, call} from './local-flow-client.mjs';

export async function prepareContextPhoneFixture(session, driver, parent) {
  const base = (await db.doc('trips/' + session.multiSeatTripId).get()).data();
  assert(base && base.driverUserId === driver.uid);
  const rides = Array.from({length: 31}, (_, index) => 'sgm-context-phone-' + String(index).padStart(3, '0'));
  const fixture = {rides, missingRide: 'sgm-context-phone-zzz-missing', driverUid: driver.uid, parentUid: parent.uid, contexts: {}, tripIds: {}};
  const batch = db.batch();
  for (const [index, ride] of rides.entries()) {
    const tripId = 'sgm-context-trip-' + String(index).padStart(3, '0'); fixture.tripIds[ride] = tripId;
    const day = index === 0 ? 28 : index === 30 ? 29 : index;
    const title = index === 0 || index === 30 ? 'Entraînement U12' : 'Entraînement U12 - séance ' + (index + 1);
    const departureAt = `2026-10-${String(day).padStart(2, '0')}T17:45:00Z`;
    fixture.contexts[ride] = {title, departureAt,
      departureLabel: `${String(day).padStart(2, '0')} octobre 2026 à ${day < 25 ? '19:45' : '18:45'}`};
    batch.create(db.doc('trips/' + tripId), {...base, id: tripId, title, departureAt, status: 'completed', activeRideSessionId: ride});
    batch.create(db.doc('rideSessions/' + ride), {tripId, status: 'completed', driverUserId: driver.uid, participantUserIds: [parent.uid]});
  }
  batch.create(db.doc('rideSessions/' + fixture.missingRide), {status: 'completed', driverUserId: driver.uid, participantUserIds: [parent.uid]});
  await batch.commit();
  for (const rideSessionId of [...rides.slice(0, 30), fixture.missingRide])
    await call('submitRating', driver, {rideSessionId, ratedUserId: parent.uid, score: 4});
  return fixture;
}

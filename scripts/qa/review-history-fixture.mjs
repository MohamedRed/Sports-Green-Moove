import {Timestamp} from 'firebase-admin/firestore';
import {auth, call, db} from './local-flow-client.mjs';

export async function createReviewHistoryFixture(driver, parent) {
  const peers = [parent.uid, 'sgm-review-history-parent-2', 'sgm-review-history-parent-3', 'sgm-review-history-parent-4'];
  for (const uid of peers.slice(1)) await auth.createUser({uid, email: uid + '@example.test', password: process.env.SGM_QA_PASSWORD});
  const rides = Array.from({length: 26}, (_, i) => 'sgm-review-history-' + String(i).padStart(3, '0'));
  const fixture = {driverUid: driver.uid, parentUid: parent.uid, peers, rides, freshRide: 'sgm-review-history-zzz-unrated'};
  for (const rideSessionId of rides) {
    await createCompletedReviewRide(fixture, rideSessionId);
    for (const ratedUserId of peers) await call('submitRating', driver, {rideSessionId, ratedUserId, score: 4});
  }
  return fixture;
}

export async function createCompletedReviewRide(fixture, id = fixture.freshRide) {
  if (![...fixture.rides, fixture.freshRide].includes(id)) throw new Error('Unknown review fixture ride');
  await db.doc('rideSessions/' + id).create({driverUserId: fixture.driverUid,
    participantUserIds: [fixture.driverUid, ...fixture.peers], status: 'completed', completedAt: Timestamp.now()});
}

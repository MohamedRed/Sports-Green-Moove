import assert from 'node:assert/strict';
import {FieldValue} from 'firebase-admin/firestore';
import {auth, db, call, signIn, tripInput, viewedBooking, document} from './local-flow-client.mjs';

export async function seedCancellationPhoneFixture() {
  const second = {uid: 'sgm-qa-cancel-parent-two', email: 'cancel-parent-two@example.test'};
  await auth.createUser({...second, emailVerified: true, displayName: 'Parent annulation QA', password: process.env.SGM_QA_PASSWORD});
  await auth.setCustomUserClaims(second.uid, {roleKeys: ['parent']});
  await db.collection('users').doc(second.uid).set({displayName: 'Parent annulation QA', roles: {parent: true}});
  await db.collection('memberships').doc(second.uid + '_sgm-qa-club-green-wavre').set({userId: second.uid,
    clubId: 'sgm-qa-club-green-wavre', role: 'member', status: 'active', active: true});
  await db.collection('clubs').doc('sgm-qa-club-green-wavre').update({memberCount: FieldValue.increment(1)});
  const driver = await signIn('d@example.test'), parent = await signIn('p@example.test'), other = await signIn(second.email);
  assert.equal(driver.uid, 'sgm-qa-driver'); assert.equal(parent.uid, 'sgm-qa-parent'); assert.equal(other.uid, second.uid);
  for (const actor of [driver, parent, other]) await call('initializeUserProfile', actor);
  const {tripId} = await call('createTrip', driver, {...tripInput(), title: 'Annulation familles QA',
    departureAt: new Date(Date.now() + 24 * 3600_000).toISOString(), seatsTotal: 4, seatsAvailable: 4, priceCents: 0});
  const request = async (actor, data) => (await call('requestBooking', actor, await viewedBooking(actor, {tripId, ...data}))).bookingId;
  const approved = await request(parent, {childId: 'sgm-qa-child-lina', seats: 2});
  await call('approveBooking', driver, {bookingId: approved});
  const pending = await request(other, {seats: 1});
  const closed = await request(parent, {seats: 1});
  await call('cancelBooking', parent, {bookingId: closed});
  assert.equal((await document('trips', tripId)).seatsAvailable, 2);
  const initialPreview = await call('getTripCancellation', driver, {tripId});
  assert.equal(initialPreview.status, 'ready'); assert.equal(initialPreview.bookingCount, 2); assert.equal(initialPreview.refundPendingCount, 0);
  return {tripId, title: 'Annulation familles QA', driverUid: driver.uid, parentUids: [parent.uid, other.uid],
    activeBookingIds: [approved, pending], approvedBookingId: approved, pendingBookingId: pending,
    alreadyClosedBookingId: closed, secondParentEmail: second.email, initialPreview,
    preparationMethod: 'authenticated-isolated-services-not-phone-booking-or-consent-proof',
    syntheticPaidMetadata: false, realPaymentExercised: false, providerRequests: 0};
}

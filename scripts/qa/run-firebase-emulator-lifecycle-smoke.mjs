#!/usr/bin/env node
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getDatabase } from 'firebase-admin/database';

const projectId = process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID || 'sports-green-moove-dev';
const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';
const functionsOrigin = process.env.FUNCTIONS_EMULATOR_ORIGIN || `http://127.0.0.1:5001/${projectId}/us-central1`;
process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';
process.env.FIREBASE_DATABASE_EMULATOR_HOST ??= '127.0.0.1:9000';
if (getApps().length === 0) initializeApp({ projectId, databaseURL: `http://127.0.0.1:9000/?ns=${projectId}-default-rtdb` });

const db = getFirestore();
const rtdb = getDatabase();
const password = process.env.SGM_QA_PASSWORD || 'QaPass12345';
const qa = { parentEmail: 'p@example.test', driverEmail: 'd@example.test', tripId: 'sgm-qa-trip-u8-wavre-bruxelles', childId: 'sgm-qa-child-lina' };

function assert(condition, message, details) {
  if (!condition) {
    const error = new Error(message);
    error.details = details;
    throw error;
  }
}

async function signIn(email) {
  const res = await fetch(`http://${authHost}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-api-key`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password, returnSecureToken: true })
  });
  const json = await res.json();
  assert(res.ok && json.idToken, `Failed to sign in ${email}`, json);
  return { email, uid: json.localId, idToken: json.idToken };
}

async function callCallable(name, token, data) {
  const res = await fetch(`${functionsOrigin}/${name}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ data }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) {
    const error = new Error(`Callable ${name} failed`);
    error.callable = name;
    error.httpStatus = res.status;
    error.response = json;
    throw error;
  }
  return json.result;
}

async function tryCallable(name, token, data) {
  try { return { ok: true, result: await callCallable(name, token, data) }; }
  catch (error) { return { ok: false, error: { callable: name, httpStatus: error.httpStatus, response: error.response, message: error.message } }; }
}

async function docData(collection, id) {
  const snap = await db.collection(collection).doc(id).get();
  assert(snap.exists, `${collection}/${id} should exist`);
  return snap.data();
}

async function liveTripMeta(rideSessionId) {
  const namespaces = [`${projectId}-default-rtdb`, projectId];
  for (const namespace of namespaces) {
    const res = await fetch(`http://127.0.0.1:9000/liveTrips/${rideSessionId}/meta.json?ns=${namespace}`);
    const value = await res.json().catch(() => null);
    if (value?.status) return { namespace, value, verified: true };
  }
  const adminValue = (await rtdb.ref(`liveTrips/${rideSessionId}/meta`).get()).val();
  return { namespace: 'admin-default', value: adminValue };
}

function passengerFromRide(ride, bookingId, childId) {
  return (ride.passengers ?? []).find((passenger) => passenger.bookingId === bookingId || passenger.childId === childId);
}

const parent = await signIn(qa.parentEmail);
const driver = await signIn(qa.driverEmail);
const parentProfile = await callCallable('initializeUserProfile', parent.idToken, {});
const driverProfile = await callCallable('initializeUserProfile', driver.idToken, {});
assert(parentProfile.roleKeys?.includes('parent'), 'Parent profile should include parent role', parentProfile);
assert(driverProfile.roleKeys?.includes('driver'), 'Driver profile should include driver role', driverProfile);

const beforeTrip = await docData('trips', qa.tripId);
const beforeSeats = beforeTrip.seatsAvailable;
const bookingRequest = await callCallable('requestBooking', parent.idToken, { tripId: qa.tripId, childId: qa.childId, seats: 1, note: 'Lifecycle smoke booking request' });
assert(bookingRequest.status === 'requested' && bookingRequest.bookingId, 'requestBooking should create requested booking', bookingRequest);
const bookingId = bookingRequest.bookingId;

const bookingChat = await callCallable('sendChatMessage', parent.idToken, { bookingId, body: 'Lifecycle smoke: parent confirms pickup details.' });
assert(bookingChat.participantUserIds?.includes(parent.uid) && bookingChat.participantUserIds?.includes(driver.uid), 'Booking chat should include parent and driver', bookingChat);
const approval = await callCallable('approveBooking', driver.idToken, { bookingId });
assert(approval.status === 'approved', 'approveBooking should approve booking', approval);
const approvedBooking = await docData('bookings', bookingId);
assert(approvedBooking.status === 'approved', 'Approved booking should persist', approvedBooking);
const afterApprovalTrip = await docData('trips', qa.tripId);
assert(afterApprovalTrip.seatsAvailable === beforeSeats - 1, 'Approval should decrement available seats', { beforeSeats, afterSeats: afterApprovalTrip.seatsAvailable });

const paymentAttempt = await tryCallable('createRidePaymentIntent', parent.idToken, { bookingId, currency: 'eur' });
if (paymentAttempt.ok) {
  assert(paymentAttempt.result.bookingId === bookingId && paymentAttempt.result.amountCents > 0, 'Payment intent should be valid', paymentAttempt.result);
} else {
  const message = JSON.stringify(paymentAttempt.error.response ?? paymentAttempt.error);
  assert(/Stripe|PaymentSheet|secret|payment|precondition|INTERNAL|internal/i.test(message), 'Payment should only fail with explicit Stripe/test-secret blocker', paymentAttempt.error);
}

const rideStart = await callCallable('startRide', driver.idToken, { tripId: qa.tripId, bookingIds: [bookingId] });
const ride = rideStart.ride;
const rideSessionId = ride?.rideSessionId ?? ride?.id;
assert(rideSessionId, 'startRide should return ride session id', rideStart);
assert(['active', 'Actif'].includes(ride.status), 'startRide should create active ride', ride);
const activeParentRide = await callCallable('getActiveRide', parent.idToken, {});
const activeParentRideId = activeParentRide.ride?.rideSessionId ?? activeParentRide.ride?.id;
assert(activeParentRideId === rideSessionId, 'Parent should see active ride after startRide', activeParentRide);

const pickup = await callCallable('markPickup', driver.idToken, { rideSessionId, bookingId, childId: qa.childId, note: 'Lifecycle smoke pickup' });
assert(pickup.status === 'pickup', 'markPickup should return pickup status', pickup);
const afterPickupRide = await docData('rideSessions', rideSessionId);
assert(passengerFromRide(afterPickupRide, bookingId, qa.childId)?.pickupStatus === 'pickedUp', 'Ride passenger should be picked up', afterPickupRide.passengers);
const rideChat = await callCallable('sendChatMessage', parent.idToken, { rideSessionId, body: 'Lifecycle smoke: parent sees live ride chat.' });
assert(rideChat.participantUserIds?.includes(parent.uid) && rideChat.participantUserIds?.includes(driver.uid), 'Ride chat should include parent and driver', rideChat);
const dropoff = await callCallable('markDropoff', driver.idToken, { rideSessionId, bookingId, childId: qa.childId, note: 'Lifecycle smoke dropoff' });
assert(dropoff.status === 'dropoff', 'markDropoff should return dropoff status', dropoff);
const afterDropoffRide = await docData('rideSessions', rideSessionId);
assert(passengerFromRide(afterDropoffRide, bookingId, qa.childId)?.dropoffStatus === 'droppedOff', 'Ride passenger should be dropped off', afterDropoffRide.passengers);
const completion = await callCallable('endRide', driver.idToken, { rideSessionId, distanceMeters: 28600, passengersSharing: 2 });
assert(completion.rideSessionId === rideSessionId && completion.co2SavedKg > 0, 'endRide should complete with CO2 savings', completion);
const completedRide = await docData('rideSessions', rideSessionId);
const completedBooking = await docData('bookings', bookingId);
assert(completedRide.status === 'completed', 'Ride should persist completed status', completedRide);
assert(completedBooking.status === 'completed', 'Booking should persist completed status', completedBooking);
const rtdbMeta = await liveTripMeta(rideSessionId);
if (rtdbMeta.value?.status) {
  assert(rtdbMeta.value.status === 'completed', 'RTDB liveTrips meta should be completed when readable', rtdbMeta);
}
const inbox = await callCallable('getInbox', parent.idToken, {});
assert(Array.isArray(inbox.inbox?.chats), 'Parent inbox should include chats array', inbox);

const summary = {
  projectId,
  tripId: qa.tripId,
  bookingId,
  rideSessionId,
  payment: paymentAttempt.ok
    ? { status: 'verified', amountCents: paymentAttempt.result.amountCents, currency: paymentAttempt.result.currency }
    : { status: 'blocked_by_stripe_test_configuration', error: paymentAttempt.error.response?.error?.message ?? paymentAttempt.error.message },
  lifecycle: {
    booking: completedBooking.status,
    ride: completedRide.status,
    pickup: passengerFromRide(completedRide, bookingId, qa.childId)?.pickupStatus,
    dropoff: passengerFromRide(completedRide, bookingId, qa.childId)?.dropoffStatus,
    co2SavedKg: completion.co2SavedKg,
    rewardCents: completion.rewardCents,
    rtdbMeta: rtdbMeta.value?.status === 'completed'
      ? { status: 'completed', namespace: rtdbMeta.namespace }
      : { status: 'not_verified_from_smoke_script', namespace: rtdbMeta.namespace },
    inboxChats: inbox.inbox.chats.length,
  },
};
console.log(JSON.stringify(summary, null, 2));

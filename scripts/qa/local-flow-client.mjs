import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { configureLocalEmulators } from './local-emulator-config.mjs';
export { tripInput } from './local-trip-input.mjs';

const config = configureLocalEmulators();
initializeApp({ projectId: config.projectId, databaseURL: config.databaseURL });
export const { firestore: db } = await import('../../functions/lib/lib/firestore.js');
export const auth = getAuth();
const { bookingIntentSnapshot } = await import('../../functions/lib/domain/bookingIntent.js');

export async function viewedBooking(actor, data) {
  assert(typeof actor?.uid === 'string' && actor.uid.length > 0, 'An explicit booking account is required');
  assert(!Object.hasOwn(data, 'expectedBookingIntent'), 'Submit an already captured snapshot directly, without refreshing it');
  const trip = await document('trips', data.tripId);
  return { clientRequestId: randomUUID(), ...data, requesterUserId: actor.uid,
    expectedBookingIntent: bookingIntentSnapshot({ ...trip, id: data.tripId }) };
}

export async function signIn(email) {
  const response = await fetch(`http://${config.authHost}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-api-key`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: process.env.SGM_QA_PASSWORD, returnSecureToken: true }),
  });
  const result = await response.json();
  assert(response.ok && result.idToken, 'Local fixture sign-in failed');
  return { uid: result.localId, token: result.idToken };
}

export async function call(name, actor, data = {}) {
  const response = await fetch(`${config.functionsOrigin}/${name}`, {
    method: 'POST', headers: { 'content-type': 'application/json',
      ...(actor ? { authorization: `Bearer ${actor.token}` } : {}) }, body: JSON.stringify({ data }),
  });
  const json = await response.json();
  if (!response.ok || json.error) {
    const error = new Error(`${name}: ${json.error?.message || 'request failed'}`);
    error.code = json.error?.status;
    throw error;
  }
  return json.result;
}

export async function denied(name, actor, data, code) {
  await assert.rejects(() => call(name, actor, data), (error) => error.code === code,
    `${name} must reject with ${code}`);
}

export async function document(collection, id) {
  const snapshot = await db.collection(collection).doc(id).get();
  assert(snapshot.exists, `${collection} record must exist`);
  return snapshot.data();
}

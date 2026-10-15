import assert from 'node:assert/strict';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { configureLocalEmulators } from './local-emulator-config.mjs';

const config = configureLocalEmulators();
initializeApp({ projectId: config.projectId, databaseURL: config.databaseURL });
export const db = getFirestore();
export const auth = getAuth();

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

export function tripInput() {
  const departure = new Date(Date.now() + 36 * 3600_000);
  return { title: 'Local QA trip', sport: 'Football', clubName: 'Green Wavre QA Club',
    clubId: 'sgm-qa-club-green-wavre', teamId: 'sgm-qa-club-green-wavre-u8', category: 'U 7/8',
    departureAt: departure.toISOString(), origin: { lat: 50.7167, lng: 4.6167 },
    destination: { lat: 50.8503, lng: 4.3517 }, pickupRadiusM: 1500,
    seatsTotal: 4, seatsAvailable: 4, baggage: 'medium', returnTrip: false, priceCents: 0,
    supportsVehicleTracking: true, supportsChildTracking: true, co2SavedKgEstimate: 7.4 };
}

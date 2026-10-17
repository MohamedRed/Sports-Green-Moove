import './local-egress-guard.mjs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { initializeApp } from 'firebase-admin/app';
import { Timestamp } from 'firebase-admin/firestore';
import { configureLocalEmulators } from './local-emulator-config.mjs';
import { tripInput } from './local-trip-input.mjs';
import { bookingIntentSnapshot } from '../../functions/lib/domain/bookingIntent.js';

const sourceRoot = process.env.SGM_QA_BOOKING_HANDLER_ROOT || resolve(import.meta.dirname, '../../functions');
const config = configureLocalEmulators();
initializeApp({ projectId: config.projectId, databaseURL: config.databaseURL });
const { firestore: db } = await import(pathToFileURL(resolve(sourceRoot, 'lib/lib/firestore.js')).href);
const { requestBooking } = await import(pathToFileURL(resolve(sourceRoot, 'lib/callables/bookingRequests.js')).href);
const parentUserId = 'sgm-qa-displayed-parent';
const mutations = [
  ['price', { priceCents: 900 }], ['departure', (trip) => ({ departureAt: new Date(Date.parse(trip.departureAt) + 3600_000).toISOString() })],
  ['arrival', (trip) => ({ arrivalBy: new Date(Date.parse(trip.departureAt) + 7200_000).toISOString() })],
  ['origin', { origin: { lat: 50.75, lng: 4.61 } }], ['destination', { destination: { lat: 50.88, lng: 4.36 } }],
  ['driver', { driverUserId: 'sgm-qa-displayed-other-driver' }], ['club', { clubId: 'sgm-qa-other-club' }],
  ['team', { teamId: 'sgm-qa-other-team' }], ['category', { category: 'U10' }],
  ['pickup', { pickupRadiusM: 1600 }], ['baggage', { baggage: 'large' }], ['return', { returnTrip: true }],
  ['vehicle-tracking', { supportsVehicleTracking: false }], ['child-tracking', { supportsChildTracking: false }],
  ['total-seats', { seatsTotal: 5 }], ['applied-revision', { appliedChangeId: 'b'.repeat(64) }],
];
const scenarios = [
  ...mutations.map(([id, mutation]) => ({ id, mutation, error: 'aborted' })),
  { id: 'missing-snapshot', error: 'invalid-argument', snapshot: undefined },
  { id: 'malformed-snapshot', error: 'invalid-argument', snapshot: {} },
  { id: 'cosmetic-title', mutation: { title: 'Current QA title' } },
  { id: 'available-capacity', mutation: { seatsAvailable: 3 } },
  { id: 'unchanged' },
  { id: 'fresh-review', mutation: { priceCents: 900, appliedChangeId: 'c'.repeat(64) }, refresh: true },
  { id: 'timestamp-document', timestamp: true }, { id: 'date-document', date: true },
  { id: 'equivalent-time-format', equivalentTime: true },
];
const cases = [];
for (const scenario of scenarios) {
  const trip = db.collection('trips').doc(`sgm-qa-displayed-${scenario.id}`);
  const initial = { ...tripInput(), driverUserId: 'sgm-qa-displayed-driver', status: 'published',
    priceCents: 250, appliedChangeId: 'a'.repeat(64) };
  if (scenario.timestamp) initial.departureAt = Timestamp.fromDate(new Date(initial.departureAt));
  if (scenario.date) initial.departureAt = new Date(initial.departureAt);
  await trip.set(initial);
  const displayed = bookingIntentSnapshot(initial);
  if (scenario.mutation) await trip.update(typeof scenario.mutation === 'function' ? scenario.mutation(initial) : scenario.mutation);
  const current = (await trip.get()).data();
  const expected = Object.hasOwn(scenario, 'snapshot') ? scenario.snapshot :
    scenario.refresh ? bookingIntentSnapshot(current) : displayed;
  if (scenario.equivalentTime) expected.terms.departureAt =
    new Date(Date.parse(expected.terms.departureAt) + 7200_000).toISOString().replace('Z', '+02:00');
  let returned, rejected, failure;
  try { returned = await requestBooking.run({ data: { tripId: trip.id, seats: 2, expectedBookingIntent: expected },
    auth: { uid: parentUserId, token: { roleKeys: ['parent'] } } }); }
  catch (error) { rejected = { code: error.code, message: error.message }; }
  const saved = await db.collection('bookings').where('tripId', '==', trip.id).get();
  try {
    if (scenario.error) { assert.equal(rejected?.code, scenario.error); assert.equal(saved.size, 0); }
    else {
      assert.equal(rejected, undefined); assert.equal(saved.size, 1);
      assert.equal(saved.docs[0].data().agreedPriceCents, current.priceCents);
      assert.equal(saved.docs[0].data().agreedAmountCents, current.priceCents * 2);
      assert.equal(saved.docs[0].data().tripTermsRevision, current.appliedChangeId);
      assert.equal(returned.trip.title, current.title);
      if (scenario.timestamp || scenario.date) assert.notEqual(returned.trip.dateLabel, 'DATE À CONFIRMER');
    }
  } catch (error) { failure = error.message; process.exitCode = 1; }
  cases.push({ id: scenario.id, status: failure ? 'failed' : 'passed', failure, expectedError: scenario.error,
    bookingCount: saved.size, rejected, refreshed: scenario.refresh === true, displayedPriceCents: expected?.terms?.priceCents,
    currentPriceCents: current.priceCents, displayedIntent: displayed, submittedIntent: expected,
    saved: saved.docs.map((doc) => ({ id: doc.id, seats: doc.data().seats, agreedPriceCents: doc.data().agreedPriceCents,
      agreedAmountCents: doc.data().agreedAmountCents, tripTermsRevision: doc.data().tripTermsRevision })) });
}
const sourceSha256 = Object.fromEntries(['callables/bookingRequests.ts', 'domain/bookingIntent.ts', 'lib/clientTrips.ts']
  .map((path) => [path, createHash('sha256').update(readFileSync(resolve(sourceRoot, 'src', path))).digest('hex')]));
const result = { runId: process.env.SGM_LOCAL_RUN_ID, testedAt: new Date().toISOString(), projectId: process.env.GCLOUD_PROJECT,
  scope: 'controlled-displayed-booking-intent-not-phone-ui', sourceRef: process.env.SGM_QA_BOOKING_SOURCE_REF || 'working-tree',
  sourceSha256, passed: cases.every((item) => item.status === 'passed'), cases, livePayment: false, productionDeployed: false };
mkdirSync(dirname(process.env.SGM_LOCAL_FLOW_OUTPUT), { recursive: true });
writeFileSync(process.env.SGM_LOCAL_FLOW_OUTPUT, `${JSON.stringify(result, null, 2)}\n`);
console.log(`Displayed booking intent: ${cases.filter((item) => item.status === 'passed').length}/${cases.length} cases passed.`);

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { createRealMapsFetch } from './real-maps-fetch.mjs';

await import('./local-egress-guard.mjs');
assert.equal(process.env.SGM_APPROVED_REAL_MAPS, 'isolated-five-requests');
const keyFile = process.env.SGM_REAL_MAPS_KEY_FILE;
const apiKey = readFileSync(keyFile, 'utf8');
unlinkSync(keyFile);
const maps = createRealMapsFetch(apiKey);
const { call, denied, db, document, signIn, tripInput, viewedBooking } = await import('./local-flow-client.mjs');
const { GooglePlacesProvider } = await import('../../functions/lib/services/googlePlaces.js');
const { GoogleRoutesProvider } = await import('../../functions/lib/services/googleRoutes.js');
const { quoteTripChangeApplication } = await import('../../functions/lib/services/tripChangeApplication.js');

try {
  execFileSync(process.execPath, [resolve(import.meta.dirname, 'seed-firebase-emulator.mjs')],
    { env: process.env, stdio: ['ignore', 'pipe', 'pipe'], timeout: 90_000 });
  const driver = await signIn('d@example.test'), parent = await signIn('p@example.test'), second = await signIn('c@example.test');
  const places = new GooglePlacesProvider({ apiKey, fetcher: maps.fetch });
  const endpoints = [];
  for (const query of ['Gare de Wavre', 'Gare de Louvain-la-Neuve']) {
    const suggestions = await places.suggestPlaces(query);
    assert(suggestions.length > 0, 'Real map service must return an address');
    const place = await places.resolvePlace(suggestions[0].placeId);
    assert.equal(place.placeId, suggestions[0].placeId);
    assert(place.location.lat > 49 && place.location.lat < 52 && place.location.lng > 2 && place.location.lng < 7);
    endpoints.push({ query, placeId: place.placeId, label: place.label, location: place.location });
  }
  assert.notDeepEqual(endpoints[0].location, endpoints[1].location);
  const { tripId } = await call('createTrip', driver, { ...tripInput(), title: 'QA isolated real-route consent', priceCents: 0 });
  const bookingIds = [];
  for (const actor of [parent, second]) {
    const { bookingId } = await call('requestBooking', actor, await viewedBooking(actor, { tripId, seats: 1 }));
    await call('approveBooking', driver, { bookingId });
    bookingIds.push(bookingId);
  }
  const before = await document('trips', tripId);
  const preview = await call('getTripChangePreview', driver, { tripId });
  const terms = { ...preview.terms, origin: endpoints[0].location, destination: endpoints[1].location,
    departureAt: new Date(Date.parse(preview.terms.departureAt) + 1800_000).toISOString() };
  const proposal = await call('proposeTripChanges', driver, { tripId, requestId: randomUUID(), expectedRevision: preview.revision, terms });
  const quoteInput = { tripId, proposalId: proposal.proposalId, proposalRevision: proposal.revision, requestId: randomUUID() };
  const provider = new GoogleRoutesProvider({ apiKey, fetcher: maps.fetch });
  const blocked = async () => assert.rejects(() => quoteTripChangeApplication(quoteInput, driver.uid, provider),
    (error) => error.code === 'failed-precondition');
  await blocked();
  for (const [index, actor] of [parent, second].entries()) {
    const review = await call('getTripChangeReview', actor, { tripId, proposalId: proposal.proposalId });
    assert.deepEqual(review.bookingIds, [bookingIds[index]]);
    assert.deepEqual(review.terms, terms);
    assert(!Object.hasOwn(review, 'parentUserIds') && !Object.hasOwn(review, 'decisions'));
    const accepted = await call('respondToTripChanges', actor, { ...quoteInput, requestId: randomUUID(), decision: 'accept' });
    assert.equal(accepted.acceptedParentCount, index + 1);
    assert.equal(accepted.status, index === 0 ? 'pending' : 'confirmed');
    assert.deepEqual((await document('trips', tripId)).origin, before.origin);
    assert.equal((await document('trips', tripId)).departureAt, before.departureAt);
    if (index === 0) await blocked();
  }
  assert.equal(maps.receipts().length, 4, 'Unconfirmed proposals cannot make route requests');
  const quote = await quoteTripChangeApplication(quoteInput, driver.uid, provider);
  assert(quote.route.distanceMeters > 0 && quote.route.durationSeconds > 0 && quote.route.encodedPolyline?.length > 0);
  assert.deepEqual(await quoteTripChangeApplication(quoteInput, driver.uid, provider), quote);
  assert.equal(maps.receipts().length, 5, 'Repeated quote identity cannot create a second billable request');
  const applyInput = { ...quoteInput, requestId: randomUUID(), quoteId: quote.quoteId };
  for (const actor of [parent, second]) await denied('applyTripChanges', actor, applyInput, 'PERMISSION_DENIED');
  const applied = await call('applyTripChanges', driver, applyInput);
  assert.equal(applied.status, 'applied'); assert.equal(applied.settlementRequiredCount, 0);
  assert.deepEqual(await call('applyTripChanges', driver, applyInput), applied);
  const saved = await document('trips', tripId);
  assert.deepEqual(saved.origin, terms.origin); assert.deepEqual(saved.destination, terms.destination);
  assert.equal(saved.departureAt, terms.departureAt); assert.equal(saved.appliedChangeId, proposal.proposalId);
  assert.equal(saved.distanceKm, quote.route.distanceMeters / 1000);
  assert.equal(saved.routeDurationSeconds, quote.route.durationSeconds);
  assert.equal(saved.routeEncodedPolyline, quote.route.encodedPolyline);
  for (const bookingId of bookingIds) {
    const booking = await document('bookings', bookingId);
    assert.equal(booking.tripTermsRevision, proposal.revision);
    assert.equal(booking.agreedPriceCents, 0); assert.equal(booking.tripChangeBalanceCents, 0);
    assert(!booking.paymentIntentId && !booking.paymentAttempt && !booking.amountPaidCents);
  }
  const balances = await db.collection('tripChangeBalances').where('proposalId', '==', proposal.proposalId).get();
  assert.equal(balances.size, 2);
  assert(balances.docs.every((item) => item.data().state === 'notRequired' && item.data().balanceCents === 0));
  const notes = await db.collection('notifications').where('proposalId', '==', proposal.proposalId).get();
  assert.equal(notes.docs.filter((item) => item.data().title === 'Trajet modifié').length, 3);
  for (const actor of [parent, second]) {
    const review = await call('getTripChangeReview', actor, { tripId, proposalId: proposal.proposalId });
    assert.equal(review.status, 'applied'); assert.equal(review.applied, true);
  }
  const result = { projectId: 'demo-sgm-local-qa', runId: process.env.SGM_LOCAL_RUN_ID, testedAt: new Date().toISOString(),
    status: 'passed', scope: 'local-callables-and-service-quote-with-real-maps-not-native-ui',
    tripId, bookingIds, proposalId: proposal.proposalId, endpoints, route: quote.route,
    providerRequests: maps.receipts(), parentCount: 2, acceptedParentCount: 2, application: applied,
    steps: ['real-address-selection', 'two-parent-confirmation', 'unconfirmed-route-quote-denied',
      'real-route-calculation', 'quote-idempotency', 'parent-application-denied', 'driver-application',
      'persisted-route-and-booking-verification', 'zero-payment-required'].map((id) => ({ id, status: 'passed' })),
    quoteThroughCallable: false, nativeUi: false, physicalDevice: false, productionDataWritten: false,
    paymentExercised: false, refundIssued: false, syntheticRoute: false };
  writeFileSync(process.env.SGM_LOCAL_FLOW_OUTPUT, JSON.stringify(result, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
  console.log('Isolated real-map backend test passed; five provider requests, two parent confirmations, no payments.');
} catch (error) {
  writeFileSync(process.env.SGM_LOCAL_FLOW_OUTPUT, JSON.stringify({ projectId: 'demo-sgm-local-qa', runId: process.env.SGM_LOCAL_RUN_ID,
    testedAt: new Date().toISOString(), status: 'failed', providerRequests: maps.receipts(), nativeUi: false,
    productionDataWritten: false, paymentExercised: false }, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
  // Emit the assertion stack only after removing the sole provider credential.
  console.error(String(error.stack ?? error).replaceAll(apiKey, '[REDACTED]'));
  process.exitCode = 1;
}

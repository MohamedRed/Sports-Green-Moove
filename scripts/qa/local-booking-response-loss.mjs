import './local-egress-guard.mjs';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { db, signIn, call, document, tripInput, viewedBooking } from './local-flow-client.mjs';
import { openPostCommitLossProxy, postJsonWithoutRetry } from './post-commit-loss-proxy.mjs';
import { checkBookingRequestRaces } from './local-booking-request-races.mjs';

execFileSync(process.execPath, [resolve(import.meta.dirname, 'seed-firebase-emulator.mjs')],
  { env: process.env, stdio: ['ignore', 'pipe', 'pipe'], timeout: 90_000 });
const parent = await signIn('p@example.test'), driver = await signIn('d@example.test');
const { tripId } = await call('createTrip', driver, { ...tripInput(), title: 'Local booking response-loss QA' });
const input = { ...await viewedBooking(parent, { tripId, childId: 'sgm-qa-child-lina', seats: 2 }), clientRequestId: randomUUID() };
const records = () => db.collection('bookings').where('tripId', '==', tripId).get();
const checks = [];
const check = (id, action) => {
  try { action(); checks.push({ id, status: 'passed' }); }
  catch (error) { checks.push({ id, status: 'failed', message: error.message }); }
};
const snapshot = async () => ({
  seatsAvailable: (await document('trips', tripId)).seatsAvailable,
  bookings: (await records()).docs.map((doc) => ({ id: doc.id, parentUserId: doc.get('parentUserId'),
    childId: doc.get('childId'), seats: doc.get('seats'), status: doc.get('status'),
    createdAtMillis: doc.get('createdAt').toMillis() })),
});
const proxy = await openPostCommitLossProxy(`${process.env.FUNCTIONS_EMULATOR_ORIGIN}/requestBooking`, async (bookingId) => {
  const saved = await records(), booking = saved.docs.find((doc) => doc.id === bookingId);
  assert.equal(saved.size, 1); assert(booking);
  assert.equal(booking.get('parentUserId'), parent.uid); assert.equal(booking.get('childId'), input.childId);
  assert.equal(booking.get('seats'), 2); assert.equal(booking.get('status'), 'requested');
  assert.equal((await document('trips', tripId)).seatsAvailable, 4);
  return { bookingId, bookingCount: saved.size, createdAtMillis: booking.get('createdAt').toMillis(), seats: 2 };
});
let firstError;
const retries = [], stages = {};
try {
  await assert.rejects(postJsonWithoutRetry(proxy.url, parent.token, input), (error) => {
    firstError = { code: error.code, responseReceived: error.responseReceived };
    return error.code === 'ECONNRESET' && error.responseReceived === false;
  });
  assert.equal(proxy.attempts.length, 1, 'The client transport must not silently retry');
  const original = proxy.attempts[0].commit;
  assert(original && proxy.attempts[0].acknowledgementDropped);
  check('independently-saved-before-lost-response', () => assert.equal(original.bookingCount, 1));
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await postJsonWithoutRetry(proxy.url, parent.token, input);
    retries.push({ phase: 'before-decision', status: response.status, bookingId: response.json.result?.bookingId });
  }
  stages.beforeDecision = await snapshot();
  check('same-request-recovers-original-identity', () => {
    assert(retries.every((retry) => retry.status === 200 && retry.bookingId === original.bookingId));
  });
  check('one-booking-after-two-explicit-retries', () => assert.equal(stages.beforeDecision.bookings.length, 1));
  check('requests-do-not-reserve-seats-before-approval', () => assert.equal(stages.beforeDecision.seatsAvailable, 4));
  await call('approveBooking', driver, { bookingId: original.bookingId });
  const afterApproval = await postJsonWithoutRetry(proxy.url, parent.token, input);
  retries.push({ phase: 'after-approval', status: afterApproval.status, bookingId: afterApproval.json.result?.bookingId });
  stages.afterApproval = await snapshot();
  check('approval-does-not-turn-replay-into-another-request', () => {
    assert.equal(afterApproval.json.result?.bookingId, original.bookingId);
    assert.equal(afterApproval.json.result?.currentBookingStatus, 'approved');
    assert.equal(stages.afterApproval.bookings.length, 1);
  });
  check('approval-retains-the-correct-two-seat-allocation', () => assert.equal(stages.afterApproval.seatsAvailable, 2));
  await call('cancelBooking', parent, { bookingId: original.bookingId, reason: 'Local response-loss cleanup' });
  const afterCancellation = await postJsonWithoutRetry(proxy.url, parent.token, input);
  retries.push({ phase: 'after-cancellation', status: afterCancellation.status, bookingId: afterCancellation.json.result?.bookingId });
  stages.afterCancellation = await snapshot();
  check('cancelled-request-replay-does-not-create-a-new-booking', () => {
    assert.equal(afterCancellation.json.result?.bookingId, original.bookingId);
    assert.equal(afterCancellation.json.result?.currentBookingStatus, 'cancelled');
    assert.equal(stages.afterCancellation.bookings.length, 1);
  });
  check('cancelled-booking-stays-closed-and-capacity-is-restored', () => {
    assert.equal(stages.afterCancellation.bookings.find((booking) => booking.id === original.bookingId)?.status, 'cancelled');
    assert.equal(stages.afterCancellation.seatsAvailable, 4);
  });
  const conflict = await postJsonWithoutRetry(proxy.url, parent.token, { ...input, seats: 3 });
  stages.afterConflict = await snapshot();
  check('same-identity-cannot-be-reused-for-different-seats', () => {
    assert.equal(conflict.status, 409); assert.equal(conflict.json.error?.status, 'ALREADY_EXISTS');
    assert.equal(stages.afterConflict.bookings.length, 1);
  });
  const anonymous = await fetch(`${process.env.FUNCTIONS_EMULATOR_ORIGIN}/requestBooking`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ data: input }),
  });
  check('anonymous-replay-remains-denied', () => assert.equal(anonymous.status, 401));
  const races = await checkBookingRequestRaces(parent, driver);
  const sourceSha256 = Object.fromEntries(['callables/bookingRequests.ts', 'domain/bookingIntent.ts',
    'domain/bookingRequestIdentity.ts', 'callables/bookingRequestResolution.ts']
    .map((path) => [path, createHash('sha256').update(readFileSync(resolve(import.meta.dirname, '../../functions/src', path))).digest('hex')]));
  const result = { runId: process.env.SGM_LOCAL_RUN_ID, testedAt: new Date().toISOString(),
    projectId: process.env.GCLOUD_PROJECT, scope: 'local-http-booking-post-commit-response-loss-not-native-ui',
    sourceSha256, passed: checks.every((item) => item.status === 'passed'), checks,
    clientRequestId: input.clientRequestId, original, firstError, retries, stages, attempts: proxy.attempts, races,
    conflict: { status: conflict.status, code: conflict.json.error?.status, bookingId: conflict.json.result?.bookingId },
    livePayment: false, productionDeployed: false };
  mkdirSync(dirname(process.env.SGM_LOCAL_FLOW_OUTPUT), { recursive: true });
  writeFileSync(process.env.SGM_LOCAL_FLOW_OUTPUT, `${JSON.stringify(result, null, 2)}\n`);
  console.log(`Booking response loss: ${checks.filter((item) => item.status === 'passed').length}/${checks.length} checks passed.`);
  if (!result.passed) process.exitCode = 1;
} finally { await proxy.close(); }

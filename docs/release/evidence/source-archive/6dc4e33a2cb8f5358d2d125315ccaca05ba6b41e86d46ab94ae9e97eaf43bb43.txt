import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { deleteApp, getApp } from 'firebase-admin/app';
import { call, db, denied, document, signIn, tripInput, viewedBooking } from './local-flow-client.mjs';
import { seedLocalUiFixtures } from './local-ui-fixtures.mjs';

const steps = [], observations = [];
const noticeId = (type, bookingId, userId) => 'bookingDecision_' + createHash('sha256').update(JSON.stringify([type, bookingId, userId])).digest('hex');
const check = async (id, action) => { await action(); steps.push({id, status: 'passed'}); };
let failure, protectedRecordCount = 0;
try {
  await seedLocalUiFixtures();
  const driver = await signIn('d@example.test'), parent = await signIn('p@example.test'), outsider = await signIn('outsider@example.test');
  const baseline = new Map();
  for (const collection of await db.listCollections()) for (const row of (await collection.get()).docs) baseline.set(row.ref.path, row.data());
  const {auth} = await import('./local-flow-client.mjs');
  const originalClaims = await Promise.all([driver, parent, outsider].map(async actor => (await auth.getUser(actor.uid)).customClaims));
  const pending = async title => {
    const {tripId} = await call('createTrip', driver, {...tripInput(), title});
    const {bookingId} = await call('requestBooking', parent, await viewedBooking(parent, {tripId, seats: 1}));
    return {tripId, bookingId};
  };
  const a = await pending('Notification accord QA'), b = await pending('Notification refus QA');
  const state = async booking => ({booking: await document('bookings', booking.bookingId), trip: await document('trips', booking.tripId)});
  const notes = async booking => (await db.collection('notifications').where('sourceId', '==', booking.bookingId).get()).docs;
  async function barrier(booking, type, actor, status, seats, callable) {
    const ref = db.collection('notifications').doc(noticeId(type, booking.bookingId, actor.uid));
    const guard = {isolatedQaWriteBarrier: true}; await ref.create(guard);
    const before = await state(booking);
    await assert.rejects(() => call(callable, callable === 'cancelBooking' ? parent : driver, {bookingId: booking.bookingId}),
      'A blocked notification write must not commit a booking decision');
    assert.deepEqual(await state(booking), before);
    assert.equal(before.booking.status, status); assert.equal(before.trip.seatsAvailable, seats);
    assert.deepEqual((await ref.get()).data(), guard);
    await ref.delete();
  }
  await check('approval-notice-write-conflict-rolls-back-decision-and-capacity', () =>
    barrier(a, 'bookingApproved', parent, 'requested', 4, 'approveBooking'));
  await check('approval-commits-one-notice-and-one-seat-change', async () => {
    await call('approveBooking', driver, {bookingId: a.bookingId});
    const saved = await state(a), notifications = await notes(a);
    assert.equal(saved.booking.status, 'approved'); assert.equal(saved.trip.seatsAvailable, 3);
    assert.equal(notifications.length, 1); assert.equal(notifications[0].id, noticeId('bookingApproved', a.bookingId, parent.uid));
    assert.equal(notifications[0].get('read'), false); assert.equal(notifications[0].get('userId'), parent.uid);
  });
  await check('approval-replay-does-not-create-extra-notices-or-remove-more-seats', async () => {
    const notice = db.collection('notifications').doc(noticeId('bookingApproved', a.bookingId, parent.uid));
    await notice.update({read: true});
    const before = await state(a); await denied('approveBooking', driver, {bookingId: a.bookingId}, 'FAILED_PRECONDITION');
    assert.deepEqual(await state(a), before); assert.equal((await notes(a)).length, 1); assert.equal((await notice.get()).get('read'), true);
  });
  await check('decline-notice-write-conflict-keeps-request-pending', () =>
    barrier(b, 'bookingDeclined', parent, 'requested', 4, 'declineBooking'));
  await check('decline-commits-one-notice-without-consuming-capacity', async () => {
    await call('declineBooking', driver, {bookingId: b.bookingId});
    assert.equal((await state(b)).booking.status, 'declined'); assert.equal((await state(b)).trip.seatsAvailable, 4);
    const notifications = await notes(b); assert.equal(notifications.length, 1);
    assert.equal(notifications[0].id, noticeId('bookingDeclined', b.bookingId, parent.uid));
  });
  await check('decline-replay-does-not-create-a-second-notice', async () => {
    const before = await state(b); await denied('declineBooking', driver, {bookingId: b.bookingId}, 'FAILED_PRECONDITION');
    assert.deepEqual(await state(b), before); assert.equal((await notes(b)).length, 1);
  });
  await check('cancellation-notice-write-conflict-keeps-approved-booking-and-capacity', () =>
    barrier(a, 'bookingCancelled', driver, 'approved', 3, 'cancelBooking'));
  await check('cancellation-commits-one-driver-notice-and-restores-one-seat', async () => {
    await call('cancelBooking', parent, {bookingId: a.bookingId});
    const saved = await state(a), notifications = await notes(a);
    assert.equal(saved.booking.status, 'cancelled'); assert.equal(saved.trip.seatsAvailable, 4);
    assert.equal(saved.booking.refundStatus, 'notRequired'); assert.equal(notifications.length, 2);
    const cancelled = notifications.find(row => row.id === noticeId('bookingCancelled', a.bookingId, driver.uid));
    assert(cancelled); assert.equal(cancelled.get('userId'), driver.uid); assert.equal(cancelled.get('read'), false);
  });
  await check('cancellation-replay-cannot-restore-capacity-or-create-notices-twice', async () => {
    const before = await state(a); await denied('cancelBooking', parent, {bookingId: a.bookingId}, 'FAILED_PRECONDITION');
    assert.deepEqual(await state(a), before); assert.equal((await notes(a)).length, 2);
  });
  await check('inbox-delivers-only-the-intended-parent-and-driver-notices', async () => {
    const all = [...await notes(a), ...await notes(b)].map(row => row.id);
    for (const [actor, expected] of [[parent, 2], [driver, 1], [outsider, 0]]) {
      const result = await call('getInbox', actor);
      const visible = result.inbox.notifications.filter(row => all.includes(row.id));
      assert.equal(visible.length, expected); observations.push({actor: actor.uid, notices: visible.map(row => row.id)});
    }
  });
  await check('concurrent-driver-approval-commits-one-decision-notice-and-seat-change', async () => {
    const c = await pending('Approbations concurrentes QA');
    const results = await Promise.allSettled([call('approveBooking', driver, {bookingId: c.bookingId}),
      call('approveBooking', driver, {bookingId: c.bookingId})]);
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
    const rejected = results.find(result => result.status === 'rejected'); assert.equal(rejected.reason.code, 'FAILED_PRECONDITION');
    assert.equal((await state(c)).trip.seatsAvailable, 3); assert.equal((await state(c)).booking.status, 'approved');
    const notifications = await notes(c); assert.equal(notifications.length, 1);
    assert.equal(notifications[0].id, noticeId('bookingApproved', c.bookingId, parent.uid));
  });
  await check('unrelated-records-and-original-claims-remain-unchanged', async () => {
    for (const [path, original] of baseline) assert.deepEqual((await db.doc(path).get()).data(), original, path);
    assert.deepEqual(await Promise.all([driver, parent, outsider].map(async actor => (await auth.getUser(actor.uid)).customClaims)), originalClaims);
    protectedRecordCount = baseline.size;
  });
} catch (error) { failure = error; }
finally {
  await deleteApp(getApp());
  const paths = ['functions/src/callables/bookings.ts', 'functions/src/callables/reservations.ts',
    'functions/src/domain/bookingNotifications.ts', 'functions/src/lib/bookingNotifications.ts', 'scripts/qa/local-booking-notices.mjs'];
  writeFileSync(process.env.SGM_LOCAL_FLOW_OUTPUT, JSON.stringify({projectId: 'demo-sgm-local-qa', runId: process.env.SGM_LOCAL_RUN_ID,
    testedAt: new Date().toISOString(), scope: 'isolated-booking-decision-and-notification-atomicity-not-phone-ui',
    completed: !failure, steps, observations, protectedRecordCount, adminClientClosed: true,
    physicalDevice: false, nativeUiExecuted: false, pushDeliveryVerified: false, paymentExercised: false, productionWrites: false,
    sourceFiles: Object.fromEntries(paths.map(path => [path, createHash('sha256').update(readFileSync(resolve(import.meta.dirname, '../..', path))).digest('hex')]))},
    null, 2) + '\n', {flag: 'wx'});
}
if (failure) throw failure;
console.log('Passed ' + steps.length + ' isolated booking decision/notice scenarios; no phone or push claim.');

import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';

export const searchBookingPhases = ['requested', 'approved', 'cancelled'];
export const searchBookingNoticeContract = 'request-and-decisions-v2';
export const historicalSearchBookingNoticeContract = 'decisions-only-v1';

export function expectedSearchBookingNotices(phase, contract = searchBookingNoticeContract) {
  assert(searchBookingPhases.includes(phase));
  assert([searchBookingNoticeContract, historicalSearchBookingNoticeContract].includes(contract));
  const expected = contract === searchBookingNoticeContract ? [['bookingRequested', 'sgm-qa-driver']] : [];
  if (phase !== 'requested') expected.push(['bookingApproved', 'sgm-qa-parent']);
  if (phase === 'cancelled') expected.push(['bookingCancelled', 'sgm-qa-driver']);
  return expected;
}

export function assertSearchBookingCheckpoint(phase, state, identity, noticeContract = searchBookingNoticeContract) {
  assert(searchBookingPhases.includes(phase));
  const { booking, trip, receipts, notifications } = state;
  for (const [key, value] of Object.entries({ tripId: identity.tripId, parentUserId: 'sgm-qa-parent',
    requesterUserId: 'sgm-qa-parent', driverUserId: 'sgm-qa-driver', childId: 'sgm-qa-child-lina', seats: 2, status: phase }))
    assert.equal(booking[key], value, key);
  assert.equal(trip.driverUserId, 'sgm-qa-driver'); assert.equal(trip.priceCents, 0);
  assert.equal(trip.seatsTotal, 4); assert.equal(trip.seatsAvailable, phase === 'approved' ? 2 : 4);
  assert.equal(trip.status, 'published'); assert(!trip.activeRideSessionId && !trip.pendingChangeId);
  assert.equal(receipts.length, 1); assert.equal(receipts[0].uid, 'sgm-qa-parent');
  assert.equal(receipts[0].state, 'committed'); assert.equal(receipts[0].response.bookingId, identity.bookingId);
  assert.equal(receipts[0].response.status, 'requested');
  assert.equal(receipts[0].response.trip.bookingIntent.terms.priceCents, 0);
  const expected = expectedSearchBookingNotices(phase, noticeContract);
  for (const notice of notifications) assert.equal(notice.sourceId, identity.bookingId);
  assert.deepEqual(notifications.map(n => [n.type, n.userId]).sort(), expected.sort());
  if (phase !== 'requested') assert(booking.approvedAt);
  if (phase === 'cancelled') {
    assert.equal(booking.cancelledByUserId, 'sgm-qa-parent'); assert.equal(booking.refundStatus, 'notRequired');
    assert(booking.cancelledAt);
  }
  assert(!booking.paymentStatus && !booking.paymentIntentId, 'No payment is part of this free trip');
  return { phase, bookingId: identity.bookingId, tripId: identity.tripId, seats: 2,
    seatsAvailable: trip.seatsAvailable, committedRequestReceipts: 1, notificationCount: notifications.length };
}

// Reads only. A phone action must commit before its checkpoint can be acknowledged.
export async function openSearchBookingCheckpoints({ runId, tripId, readState }) {
  assert.match(runId, /^[a-f0-9]{32}$/); assert(typeof tripId === 'string' && tripId.length > 0);
  const token = randomBytes(32).toString('hex'), checkpoints = [];
  let bookingId, busy = false;
  const server = createServer(async (request, response) => {
    let ownsSlot = false;
    try {
      const auth = Buffer.from(request.headers.authorization ?? ''), expected = Buffer.from(`Bearer ${token}`);
      assert(auth.length === expected.length && timingSafeEqual(auth, expected));
      assert(request.method === 'POST' && request.url === '/checkpoint' && !busy); busy = true; ownsSlot = true;
      let body = ''; for await (const chunk of request) { body += chunk; assert(Buffer.byteLength(body) <= 2048); }
      const input = JSON.parse(body);
      assert.deepEqual(Object.keys(input).sort(), ['bookingId', 'phase', 'runId', 'tripId']);
      assert.equal(input.runId, runId); assert.equal(input.tripId, tripId);
      assert.equal(input.phase, searchBookingPhases[checkpoints.length]);
      assert(typeof input.bookingId === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(input.bookingId));
      if (bookingId) assert.equal(input.bookingId, bookingId);
      const state = await readState(input.bookingId);
      const checked = assertSearchBookingCheckpoint(input.phase, state, input);
      bookingId = input.bookingId;
      checkpoints.push({ ...checked, runId, checkedAt: new Date().toISOString(), state });
      response.writeHead(200, { 'content-type': 'application/json' }); response.end(JSON.stringify({ phase: input.phase, accepted: true }));
    } catch { response.writeHead(409); response.end('Checkpoint not verified'); }
    finally { if (ownsSlot) busy = false; }
  });
  await new Promise((done, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', done); });
  return { port: server.address().port, token, receipts: () => structuredClone(checkpoints),
    close: () => new Promise((done, reject) => { server.close(error => error ? reject(error) : done()); server.closeIdleConnections(); }) };
}

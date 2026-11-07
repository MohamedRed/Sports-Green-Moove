import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createServer} from 'node:http';
import {once} from 'node:events';

const prefix = '/demo-sgm-local-qa/us-central1/';
const reads = new Set(['initializeUserProfile', 'getActiveRide', 'getProfileCity', 'getImpactSummary',
  'getRewardSummary', 'getReceivedRatingSummary', 'getInbox', 'getPendingReviews', 'listChatConversations',
  'listDriverBookingRequests', 'listReservations']);
export async function openBookingReceiptLossProxy({runId, verifyIdentity, verifyIntent, afterCommit,
  port = 5001, upstreamPort = 5002, forward = fetch}) {
  assert.match(runId, /^[a-f0-9]{32}$/);
  for (const callback of [verifyIdentity, verifyIntent, afterCommit]) assert.equal(typeof callback, 'function');
  assert([0, 5001].includes(port)); assert(Number.isInteger(upstreamPort) && upstreamPort > 1024 && upstreamPort < 65536);
  assert.notEqual(port, upstreamPort);
  const receipt = {scope: 'isolated-booking-response-withholding-not-radio-loss-or-phone-ui-proof', runId,
    phase: 'preparation', attempts: [], requests: [], failed: false};
  let chosen, firstInput, firstCommit, active = false;
  const reply = (response, status, data) => {
    response.writeHead(status, {'content-type': 'application/json', connection: 'close'}); response.end(JSON.stringify(data));
  };
  const server = createServer((request, response) => {
    const observation = {method: 'unrecognised', phase: receipt.phase, upstreamStatus: null, failed: false};
    receipt.requests.push(observation);
    void (async () => {
      assert.equal(request.method, 'POST'); assert(request.url?.startsWith(prefix));
      const method = request.url.slice(prefix.length);
      if (reads.has(method) || ['requestBooking', 'createTrip', 'cancelBooking'].includes(method)) observation.method = method;
      assert(reads.has(method) || method === 'requestBooking' || receipt.phase === 'preparation' && method === 'createTrip');
      let length = 0; const chunks = [];
      for await (const chunk of request) {length += chunk.length; assert(length <= 16_384); chunks.push(chunk);}
      const body = Buffer.concat(chunks), input = JSON.parse(body); assert.deepEqual(Object.keys(input), ['data']);
      assert.equal(typeof request.headers.authorization, 'string'); assert(request.headers.authorization.startsWith('Bearer '));
      const identity = await verifyIdentity(request.headers.authorization.slice(7));
      assert(['sgm-qa-parent', 'sgm-qa-driver'].includes(identity.uid));
      if (method === 'createTrip') assert.equal(identity.uid, 'sgm-qa-driver');
      const booking = method === 'requestBooking';
      if (booking) {
        assert(chosen); assert.equal(identity.uid, 'sgm-qa-parent'); assert(!active);
        const data = input.data;
        assert.deepEqual(Object.keys(data).sort(), ['clientRequestId', 'expectedBookingIntent', 'requesterUserId', 'seats', 'tripId']);
        assert.equal(data.tripId, chosen.tripId); assert.equal(data.seats, 1); assert.equal(data.requesterUserId, identity.uid);
        assert.match(data.clientRequestId, /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
        assert.equal(verifyIntent(data.expectedBookingIntent), chosen.intentRevision);
        if (firstInput) assert.deepEqual(data, firstInput); else firstInput = structuredClone(data);
        if (receipt.phase === 'lost') {
          receipt.attempts.push({phase: 'lost', blockedBeforeForwarding: true, upstreamAcknowledged: false, responseReleased: false});
          request.socket.destroy(); return;
        }
        assert(['armed', 'recover'].includes(receipt.phase)); active = true;
      }
      try {
        const upstream = await forward(`http://127.0.0.1:${upstreamPort}${request.url}`, {method: 'POST', body,
          redirect: 'error', signal: AbortSignal.timeout(20_000),
          headers: {'content-type': 'application/json', authorization: request.headers.authorization, connection: 'close'}});
        const result = await upstream.json(); observation.upstreamStatus = upstream.status;
        if (!booking) {reply(response, upstream.status, result); return;}
        assert.equal(upstream.status, 200); const value = result.result;
        assert.equal(typeof value.bookingId, 'string'); assert(value.bookingId.length > 0);
        assert.equal(value.clientRequestId, firstInput.clientRequestId); assert.equal(value.status, 'requested');
        assert.equal(value.currentBookingStatus, 'requested'); assert.equal(value.trip.id, chosen.tripId);
        const commit = await afterCommit(value.bookingId, value.clientRequestId);
        assert.equal(commit.bookingId, value.bookingId); assert.equal(commit.clientRequestId, value.clientRequestId);
        if (firstCommit) assert.deepEqual(commit, firstCommit); else firstCommit = structuredClone(commit);
        receipt.attempts.push({phase: receipt.phase, upstreamAcknowledged: true, responseReleased: receipt.phase === 'recover',
          upstreamStatus: 200, commit, requestSha256: createHash('sha256').update(JSON.stringify(firstInput)).digest('hex')});
        if (receipt.phase === 'armed') {receipt.phase = 'lost'; request.socket.destroy(); return;}
        reply(response, 200, result);
      } finally {if (booking) active = false;}
    })().catch(() => {receipt.failed = true; observation.failed = true;
      if (!response.destroyed && !response.headersSent) reply(response, 502, {error: {status: 'INTERNAL', message: 'Isolated booking fault setup rejected the request'}});
    });
  });
  server.requestTimeout = 25_000; server.headersTimeout = 25_000; server.listen(port, '127.0.0.1'); await once(server, 'listening');
  return {port: server.address().port, receipt,
    arm(value) {assert.equal(receipt.phase, 'preparation'); assert.equal(value.tripId, 'sgm-qa-trip-u8-wavre-bruxelles');
      assert.match(value.intentRevision, /^[a-f0-9]{64}$/); chosen = structuredClone(value); receipt.phase = 'armed';},
    recover() {assert.equal(receipt.phase, 'lost'); assert(!active); receipt.phase = 'recover';},
    async close() {const closed = once(server, 'close'); server.close(); server.closeAllConnections(); await closed;},
  };
}

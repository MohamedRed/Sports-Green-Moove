import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';

const prefix = '/demo-sgm-local-qa/us-central1/';
const reads = new Set(['initializeUserProfile', 'getActiveRide', 'getProfileCity', 'getImpactSummary',
  'getRewardSummary', 'getReceivedRatingSummary', 'getInbox', 'getPendingReviews', 'listChatConversations',
  'listDriverBookingRequests']);

export async function openReviewReceiptLossProxy({runId, verifyIdentity, port = 5001, upstreamPort = 5002, forward = fetch}) {
  assert.match(runId, /^[a-f0-9]{32}$/); assert.equal(typeof verifyIdentity, 'function');
  assert([0, 5001].includes(port)); assert(Number.isInteger(upstreamPort) && upstreamPort > 1024 && upstreamPort < 65536);
  assert.notEqual(port, upstreamPort);
  const receipt = {scope: 'isolated-callable-response-withholding-not-radio-loss-or-phone-ui-proof',
    runId, phase: 'preparation', attempts: [], requests: [], failed: false};
  let selected, activeMutation = false;
  const reply = (response, status, data) => {
    response.writeHead(status, {'content-type': 'application/json', connection: 'close'});
    response.end(JSON.stringify(data));
  };
  const server = createServer((request, response) => {
    const observation = {method: 'unrecognised', phase: receipt.phase, upstreamStatus: null, failed: false};
    receipt.requests.push(observation);
    void (async () => {
      assert.equal(request.method, 'POST'); assert(request.url?.startsWith(prefix));
      const method = request.url.slice(prefix.length);
      if (reads.has(method) || ['submitRating', 'createTrip', 'cancelTrip'].includes(method)) observation.method = method;
      assert(reads.has(method) || method === 'submitRating' || receipt.phase === 'preparation' && method === 'createTrip');
      let size = 0; const chunks = [];
      for await (const chunk of request) {size += chunk.length; assert(size <= 16_384); chunks.push(chunk);}
      const body = Buffer.concat(chunks), input = JSON.parse(body);
      assert(input && typeof input === 'object' && !Array.isArray(input)); assert.deepEqual(Object.keys(input), ['data']);
      const authorization = request.headers.authorization; assert.equal(typeof authorization, 'string');
      assert(authorization.startsWith('Bearer '));
      const identity = await verifyIdentity(authorization.slice(7));
      assert(['sgm-qa-parent', 'sgm-qa-driver'].includes(identity.uid));
      if (method === 'createTrip') assert.equal(identity.uid, 'sgm-qa-driver');
      const isRating = method === 'submitRating';
      if (isRating) {
        assert(selected); assert.equal(identity.uid, selected.uid);
        assert.deepEqual(input.data, selected.data); assert(!activeMutation);
        if (receipt.phase === 'lost') {
          receipt.attempts.push({method, phase: 'lost', uid: identity.uid, blockedBeforeForwarding: true,
            upstreamAcknowledged: false, responseReleased: false});
          request.socket.destroy(); return;
        }
        assert(['armed', 'recover'].includes(receipt.phase)); activeMutation = true;
      }
      try {
        const upstream = await forward(`http://127.0.0.1:${upstreamPort}${request.url}`, {
          method: 'POST', redirect: 'error', body, signal: AbortSignal.timeout(20_000),
          headers: {'content-type': 'application/json', authorization, connection: 'close'},
        });
        const result = await upstream.json();
        observation.upstreamStatus = upstream.status;
        if (!isRating) {reply(response, upstream.status, result); return;}
        assert.equal(upstream.status, 200); assert.deepEqual(result, {result: {ratingId: selected.ratingId}});
        const attempt = {method, phase: receipt.phase, uid: identity.uid, upstreamAcknowledged: true,
          responseReleased: receipt.phase === 'recover', ratingId: selected.ratingId, upstreamStatus: upstream.status};
        receipt.attempts.push(attempt);
        if (receipt.phase === 'armed') {receipt.phase = 'lost'; request.socket.destroy(); return;}
        reply(response, upstream.status, result);
      } finally {if (isRating) activeMutation = false;}
    })().catch(() => {
      receipt.failed = true; observation.failed = true;
      if (!response.destroyed && !response.headersSent)
        reply(response, 502, {error: {status: 'INTERNAL', message: 'Isolated review fault setup rejected the request'}});
    });
  });
  server.requestTimeout = 25_000; server.headersTimeout = 25_000;
  server.listen(port, '127.0.0.1'); await once(server, 'listening');
  return {port: server.address().port, receipt,
    arm(value) {
      assert.equal(receipt.phase, 'preparation'); assert.equal(value.uid, 'sgm-qa-parent');
      assert.equal(value.data.ratedUserId, 'sgm-qa-driver'); assert.equal(value.data.score, 5);
      assert.match(value.data.rideSessionId, /^sgm-receipt-loss-[a-z0-9-]+$/);
      assert.deepEqual(Object.keys(value.data).sort(), ['ratedUserId', 'rideSessionId', 'score']);
      assert.equal(value.ratingId, `${value.data.rideSessionId}_${value.uid}_${value.data.ratedUserId}`);
      selected = structuredClone(value); receipt.phase = 'armed';
    },
    recover() {assert.equal(receipt.phase, 'lost'); assert(!activeMutation); receipt.phase = 'recover';},
    async close() {const closed = once(server, 'close'); server.close(); server.closeAllConnections(); await closed;},
  };
}

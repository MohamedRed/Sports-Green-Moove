import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {chatNetworkPhoneBodies} from './chat-network-phone-checkpoints.mjs';

const prefix = '/demo-sgm-local-qa/us-central1/';
const reads = new Set(['initializeUserProfile', 'getActiveRide', 'getProfileCity', 'getImpactSummary',
  'getRewardSummary', 'getReceivedRatingSummary', 'getInbox', 'getPendingReviews',
  'getNotificationInbox', 'listChatConversations', 'listChatBookingOptions', 'listDriverBookingRequests']);
const preparation = {createTrip: 'sgm-qa-driver', requestBooking: 'sgm-qa-parent', approveBooking: 'sgm-qa-driver'};
const actors = ['sgm-qa-parent', 'sgm-qa-driver'];
const hash = parts => createHash('sha256').update(JSON.stringify(parts)).digest('hex');

export async function openChatReceiptLossProxy({runId, verifyIdentity, verifyCommit, port = 5001,
  upstreamPort = 5002, forward = fetch}) {
  assert.match(runId, /^[a-f0-9]{32}$/);
  assert.equal(typeof verifyIdentity, 'function'); assert.equal(typeof verifyCommit, 'function');
  assert([0, 5001].includes(port)); assert(Number.isInteger(upstreamPort) && upstreamPort > 1024 && upstreamPort < 65536);
  assert.notEqual(port, upstreamPort);
  const receipt = {runId, scope: 'isolated-post-commit-callable-reply-loss-not-radio-loss-or-phone-ui-proof',
    phase: 'preparation', attempts: [], requests: [], failed: false};
  let selected, intent, activeMutation = false;
  const reply = (response, status, data) => {
    response.writeHead(status, {'content-type': 'application/json', connection: 'close'});
    response.end(JSON.stringify(data));
  };
  const server = createServer((request, response) => {
    const observation = {method: 'unrecognised', phase: receipt.phase, upstreamStatus: null, failed: false};
    receipt.requests.push(observation);
    void (async () => {
      assert(!receipt.failed); assert.equal(request.method, 'POST'); assert(request.url?.startsWith(prefix));
      const method = request.url.slice(prefix.length), isSend = method === 'sendChatMessage';
      const isConversation = ['getChatConversation', 'markChatMessagesRead'].includes(method);
      assert(reads.has(method) || isSend || isConversation ||
        receipt.phase === 'preparation' && Object.hasOwn(preparation, method));
      observation.method = method;
      let size = 0; const chunks = [];
      for await (const chunk of request) {size += chunk.length; assert(size <= 16_384); chunks.push(chunk);}
      const body = Buffer.concat(chunks), input = JSON.parse(body);
      assert(input && typeof input === 'object' && !Array.isArray(input)); assert.deepEqual(Object.keys(input), ['data']);
      const authorization = request.headers.authorization;
      assert.equal(typeof authorization, 'string'); assert(authorization.startsWith('Bearer '));
      const {uid} = await verifyIdentity(authorization.slice(7)); assert(actors.includes(uid));
      if (Object.hasOwn(preparation, method)) assert.equal(uid, preparation[method]);
      if (isConversation) {
        assert(selected); assert.equal(input.data.sourceType, 'booking'); assert.equal(input.data.sourceId, selected.bookingId);
        if (method === 'markChatMessagesRead') {
          assert.deepEqual(Object.keys(input.data).sort(), ['messageIds', 'sourceId', 'sourceType']);
          assert(Array.isArray(input.data.messageIds)); assert(input.data.messageIds.length <= 1);
          assert(input.data.messageIds.every(id => intent && id === hash([actors[0], intent.clientMessageId])));
        }
      }
      if (isSend) {
        assert(selected); assert.equal(uid, actors[0]);
        assert.deepEqual(Object.keys(input.data).sort(), ['body', 'bookingId', 'clientMessageId']);
        assert.equal(input.data.bookingId, selected.bookingId); assert.equal(input.data.body, chatNetworkPhoneBodies.parent);
        assert.match(input.data.clientMessageId, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
        if (intent) assert.deepEqual(input.data, intent, 'The original phone send intent cannot change');
        else intent = structuredClone(input.data);
        if (receipt.phase === 'lost') {
          receipt.attempts.push({phase: 'lost', clientMessageId: intent.clientMessageId,
            blockedBeforeForwarding: true, upstreamAcknowledged: false, responseReleased: false});
          request.socket.destroy(); return;
        }
        assert(['armed', 'recover'].includes(receipt.phase)); assert(!activeMutation); activeMutation = true;
      }
      try {
        const upstream = await forward(`http://127.0.0.1:${upstreamPort}${request.url}`, {
          method: 'POST', redirect: 'error', body, signal: AbortSignal.timeout(20_000),
          headers: {'content-type': 'application/json', authorization, connection: 'close'},
        });
        const result = await upstream.json(); observation.upstreamStatus = upstream.status;
        if (!isSend) {reply(response, upstream.status, result); return;}
        assert.equal(upstream.status, 200);
        const messageId = hash([uid, intent.clientMessageId]);
        assert.deepEqual(result, {result: {messageId, participantUserIds: actors, reused: receipt.phase === 'recover'}});
        const commit = await verifyCommit(messageId, structuredClone(intent));
        assert.deepEqual(commit, {messageId, originalRecordPreserved: true, messageCount: 1, notificationCount: 1});
        receipt.attempts.push({phase: receipt.phase, clientMessageId: intent.clientMessageId, messageId,
          upstreamStatus: upstream.status, upstreamAcknowledged: true, commitIndependentlyVerified: true,
          responseReleased: receipt.phase === 'recover', observedAt: new Date().toISOString()});
        if (receipt.phase === 'armed') {receipt.phase = 'lost'; request.socket.destroy(); return;}
        reply(response, upstream.status, result);
      } finally {if (isSend) activeMutation = false;}
    })().catch(() => {
      receipt.failed = true; observation.failed = true;
      if (!response.destroyed && !response.headersSent)
        reply(response, 502, {error: {status: 'INTERNAL', message: 'Isolated chat fault setup rejected the request'}});
    });
  });
  server.requestTimeout = 25_000; server.headersTimeout = 25_000;
  server.listen(port, '127.0.0.1'); await once(server, 'listening');
  return {port: server.address().port, receipt,
    arm(value) {
      assert(!receipt.failed); assert.equal(receipt.phase, 'preparation');
      assert.deepEqual(Object.keys(value), ['bookingId']); assert.match(value.bookingId, /^[A-Za-z0-9_-]{1,128}$/);
      selected = structuredClone(value); receipt.phase = 'armed';
    },
    recover() {assert(!receipt.failed); assert.equal(receipt.phase, 'lost'); assert(!activeMutation); receipt.phase = 'recover';},
    async close() {const closed = once(server, 'close'); server.close(); server.closeAllConnections(); await closed;},
  };
}

import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';

const origin = 'http://127.0.0.1:5001/demo-sgm-local-qa/us-central1';
export const faultMessage = 'Un seul message malgré une réponse perdue.';

export async function openNativeChatLossProxy(config, verifyCommit) {
  assert.equal(config.origin, origin, 'Only isolated local callables are allowed');
  assert.match(config.runId, /^[a-f0-9]{32}$/);
  assert(config.bookingId && typeof verifyCommit === 'function');
  const receipt = { projectId: 'demo-sgm-local-qa', runId: config.runId, sourceId: config.bookingId,
    scope: 'native-sdk-controlled-post-commit-reply-loss', phase: 'loss', attempts: [], transitions: [] };
  let intent;
  const reply = (response, status, body) => {
    response.writeHead(status, { 'content-type': 'application/json', connection: 'close' });
    response.end(JSON.stringify(body));
  };
  const server = http.createServer((request, response) => {
    void (async () => {
      assert.equal(request.method, 'POST');
      const chunks = []; let length = 0;
      for await (const chunk of request) {
        length += chunk.length; assert(length <= 16_384); chunks.push(chunk);
      }
      const body = Buffer.concat(chunks), input = JSON.parse(body);
      if (request.url === '/__qa/phase') {
        assert.equal(input.runId, config.runId);
        const expected = receipt.phase === 'loss' ? 'reject' : receipt.phase === 'reject' ? 'recover' : null;
        assert(expected && input.phase === expected, 'Fault phases cannot be skipped or repeated');
        assert(receipt.attempts.some((item) => item.phase === receipt.phase));
        receipt.transitions.push({ from: receipt.phase, to: expected }); receipt.phase = expected;
        reply(response, 200, { phase: receipt.phase }); return;
      }
      const prefix = '/demo-sgm-local-qa/us-central1/';
      if (['getChatConversation', 'markChatMessagesRead'].some((name) => request.url === prefix + name)) {
        assert.equal(input.data?.sourceType, 'booking'); assert.equal(input.data.sourceId, config.bookingId);
        const upstream = await fetch(origin + '/' + request.url.slice(prefix.length), { method: 'POST', redirect: 'error',
          signal: AbortSignal.timeout(20_000), body,
          headers: { 'content-type': 'application/json', authorization: request.headers.authorization || '' } });
        reply(response, upstream.status, await upstream.json()); return;
      }
      assert.equal(request.url, prefix + 'sendChatMessage');
      const data = input.data;
      assert.equal(data?.bookingId, config.bookingId); assert.equal(data.body, faultMessage);
      assert.match(data.clientMessageId, /^[a-f0-9-]{36}$/);
      if (intent) assert.deepEqual(data, intent, 'Every retry must keep the original send intent');
      else intent = data;
      const attempt = { phase: receipt.phase, clientMessageId: data.clientMessageId, body: data.body,
        acknowledgementDropped: false, injectedRejection: false };
      receipt.attempts.push(attempt);
      if (receipt.phase === 'reject') {
        attempt.injectedRejection = true; attempt.downstreamStatus = 429;
        reply(response, 429, { error: { status: 'RESOURCE_EXHAUSTED', message: 'Controlled local retry rejection' } });
        return;
      }
      const upstream = await fetch(origin + '/sendChatMessage', { method: 'POST', redirect: 'error',
        signal: AbortSignal.timeout(20_000), body,
        headers: { 'content-type': 'application/json', authorization: request.headers.authorization || '' } });
      const result = await upstream.json();
      attempt.upstreamStatus = upstream.status;
      assert.equal(upstream.status, 200); assert.equal(typeof result.result?.messageId, 'string');
      attempt.commit = await verifyCommit(result.result.messageId, data);
      assert.equal(attempt.commit.messageId, result.result.messageId);
      if (attempt.phase === 'loss') {
        attempt.acknowledgementDropped = true; response.destroy(); return;
      }
      attempt.downstreamStatus = 200;
      reply(response, 200, result);
    })().catch(() => {
      receipt.failed = true;
      if (!response.destroyed && !response.headersSent)
        reply(response, 502, { error: { status: 'INTERNAL', message: 'Local fault setup failed' } });
    });
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  return { port: server.address().port, receipt,
    async close() { const closed = once(server, 'close'); server.close(); server.closeAllConnections(); await closed; } };
}

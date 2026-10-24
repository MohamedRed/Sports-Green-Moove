import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';

const localOrigin = 'http://127.0.0.1:5001/demo-sgm-local-qa/us-central1';
export async function openSessionRestorationFaultProxy(config, { verifyIdentity, forward = fetch }) {
  assert.equal(config.origin, localOrigin);
  assert.match(config.runId, /^[a-f0-9]{32}$/);
  assert.equal(config.uid, 'sgm-qa-parent');
  assert.equal(typeof verifyIdentity, 'function');
  const receipt = { scope: 'local-session-restoration-controlled-callable-rejection-not-network-loss',
    projectId: 'demo-sgm-local-qa', runId: config.runId, uid: config.uid, phase: 'reject', attempts: [], transitions: [] };
  const reply = (response, status, body) => {
    response.writeHead(status, { 'content-type': 'application/json', connection: 'close' });
    response.end(JSON.stringify(body));
  };
  const server = http.createServer((request, response) => {
    void (async () => {
      assert.equal(request.method, 'POST');
      const chunks = []; let size = 0;
      for await (const chunk of request) {
        size += chunk.length; assert(size <= 16_384); chunks.push(chunk);
      }
      const body = Buffer.concat(chunks), input = JSON.parse(body);
      if (request.url === '/__qa/state' || request.url === '/__qa/recover') {
        assert.deepEqual(input, { runId: config.runId });
        if (request.url === '/__qa/recover') {
          assert.equal(receipt.phase, 'reject');
          assert.equal(receipt.attempts.filter(item => item.method === 'initializeUserProfile').length, 2);
          receipt.transitions.push({ from: 'reject', to: 'recover' }); receipt.phase = 'recover';
        }
        reply(response, 200, { phase: receipt.phase,
          restorationAttempts: receipt.attempts.filter(item => item.method === 'initializeUserProfile').length });
        return;
      }
      const match = /^\/demo-sgm-local-qa\/us-central1\/(initializeUserProfile|getActiveRide|getProfileCity)$/.exec(request.url);
      assert(match, 'Only the selected restoration and read-only home/profile calls are allowed');
      assert.deepEqual(input, { data: {} });
      const authorization = request.headers.authorization;
      assert.equal(typeof authorization, 'string');
      assert(authorization.startsWith('Bearer '));
      const identity = await verifyIdentity(authorization.slice(7));
      assert.equal(identity.uid, config.uid);
      const method = match[1];
      const attempt = { phase: receipt.phase, method, uid: identity.uid };
      receipt.attempts.push(attempt);
      if (receipt.phase === 'reject') {
        assert.equal(method, 'initializeUserProfile', 'Signed-in reads must not run during a failed restoration');
        assert(receipt.attempts.length <= 2, 'No automatic restoration retry is expected');
        attempt.injectedRejection = true; attempt.downstreamStatus = 503;
        reply(response, 503, { error: { status: 'UNAVAILABLE', message: 'private-qa-session-error-detail' } });
        return;
      }
      const upstream = await forward(localOrigin + '/' + method, { method: 'POST', redirect: 'error', body,
        signal: AbortSignal.timeout(20_000), headers: { 'content-type': 'application/json', authorization } });
      const result = await upstream.json();
      attempt.upstreamStatus = upstream.status; attempt.downstreamStatus = upstream.status;
      assert.equal(upstream.status, 200);
      if (method === 'initializeUserProfile' || method === 'getProfileCity') assert.equal(result.result?.userId, config.uid);
      reply(response, upstream.status, result);
    })().catch(() => {
      receipt.failed = true;
      if (!response.destroyed && !response.headersSent)
        reply(response, 502, { error: { status: 'INTERNAL', message: 'Local restoration fault setup failed' } });
    });
  });
  server.requestTimeout = 25_000;
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  return { port: server.address().port, receipt,
    async close() { const closed = once(server, 'close'); server.close(); server.closeAllConnections(); await closed; } };
}

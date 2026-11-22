import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';

const origin = 'http://127.0.0.1:5001/demo-sgm-local-qa/us-central1/';
const endpoints = new Map([[`${origin}sendChatMessage`, 'messageId'], [`${origin}requestBooking`, 'bookingId'],
  [`${origin}respondToReport`, 'replyId'], [`${origin}submitSupportReport`, 'reportId']]);

export async function openPostCommitLossProxy(target, afterCommit) {
  const resultKey = endpoints.get(target);
  assert(resultKey, 'Fault injection is restricted to an explicitly isolated send callable');
  assert.equal(typeof afterCommit, 'function');
  const attempts = [];
  const server = http.createServer((request, response) => {
    void (async () => {
      assert.equal(request.method, 'POST');
      assert(['/', new URL(target).pathname].includes(request.url), 'Only the selected isolated callable path is allowed');
      const chunks = []; let length = 0;
      for await (const chunk of request) {
        length += chunk.length; assert(length <= 16_384, 'Local request exceeds the test bound'); chunks.push(chunk);
      }
      const upstream = await fetch(target, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(20_000),
        headers: { 'content-type': 'application/json', authorization: request.headers.authorization || '' },
        body: Buffer.concat(chunks) });
      const body = await upstream.text();
      const json = JSON.parse(body);
      const attempt = { number: attempts.length + 1, upstreamStatus: upstream.status, acknowledgementDropped: false };
      attempts.push(attempt);
      if (attempt.number === 1) {
        assert.equal(upstream.status, 200); assert.equal(typeof json.result?.[resultKey], 'string');
        attempt.commit = await afterCommit(json.result[resultKey]);
        assert.equal(attempt.commit?.[resultKey], json.result[resultKey], 'Independent commit verification is mandatory');
        attempt.acknowledgementDropped = true;
        response.destroy();
        return;
      }
      response.writeHead(upstream.status, { 'content-type': 'application/json', connection: 'close' });
      response.end(body);
    })().catch(() => {
      if (!response.destroyed && !response.headersSent) {
        response.writeHead(502, { 'content-type': 'application/json', connection: 'close' });
        response.end(JSON.stringify({ error: { status: 'INTERNAL', message: 'Local fault setup failed' } }));
      }
    });
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return { port: server.address().port, url: `http://127.0.0.1:${server.address().port}/`, attempts,
    async close() { const closed = once(server, 'close'); server.close(); server.closeAllConnections(); await closed; } };
}

export function postJsonWithoutRetry(url, token, input) {
  const parsed = new URL(url);
  assert.equal(parsed.protocol, 'http:'); assert.equal(parsed.hostname, '127.0.0.1');
  return new Promise((resolve, reject) => {
    let responseReceived = false;
    const request = http.request(parsed, { method: 'POST', agent: false,
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}`, connection: 'close' } }, (response) => {
      responseReceived = true;
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('error', reject);
      response.on('end', () => {
        try { resolve({ status: response.statusCode, json: JSON.parse(Buffer.concat(chunks).toString()), responseReceived }); }
        catch (error) { reject(error); }
      });
    });
    request.setTimeout(25_000, () => request.destroy(Object.assign(new Error('Local request timed out'), { code: 'ETIMEDOUT' })));
    request.on('error', (error) => { error.responseReceived = responseReceived; reject(error); });
    request.end(JSON.stringify({ data: input }));
  });
}

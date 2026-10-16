import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { readFileSync } from 'node:fs';
import { openPostCommitLossProxy, postJsonWithoutRetry } from '../scripts/qa/post-commit-loss-proxy.mjs';
import { content } from '../partner-portal/content.mjs';

const target = 'http://127.0.0.1:5001/demo-sgm-local-qa/us-central1/sendChatMessage';
const read = (name) => readFileSync(new URL('../' + name, import.meta.url), 'utf8');
async function upstream(action) {
  const server = http.createServer(action);
  server.listen(5001, '127.0.0.1'); await once(server, 'listening');
  return async () => { const closed = once(server, 'close'); server.close(); server.closeAllConnections(); await closed; };
}

test('the response-loss injector rejects every non-isolated or alternate callable target before opening', async () => {
  for (const url of ['https://example.com/sendChatMessage', target.replace('127.0.0.1', 'localhost'),
    target.replace('demo-sgm-local-qa', 'sports-green-moove-prod'), target + '?redirect=1',
    target.replace('sendChatMessage', 'createTrip')])
    await assert.rejects(openPostCommitLossProxy(url, () => {}), /isolated send callable/);
  assert.throws(() => postJsonWithoutRetry('https://example.com', '', {}));
});

test('the client receives no HTTP response only after an upstream success and independent commit check', async () => {
  let upstreamCalls = 0, checked = false;
  const stop = await upstream(async (request, response) => {
    upstreamCalls++;
    assert.equal(request.url, '/demo-sgm-local-qa/us-central1/sendChatMessage');
    assert.equal(request.headers.authorization, 'Bearer LOCAL_TEST_ONLY');
    const chunks = []; for await (const chunk of request) chunks.push(chunk);
    assert.deepEqual(JSON.parse(Buffer.concat(chunks)), { data: { body: 'QA' } });
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ result: { messageId: 'message-1' } }));
  });
  let proxy;
  try {
    proxy = await openPostCommitLossProxy(target, async (messageId) => {
      assert.equal(upstreamCalls, 1); checked = true;
      return { messageId, messageCount: 1 };
    });
    await assert.rejects(postJsonWithoutRetry(proxy.url, 'LOCAL_TEST_ONLY', { body: 'QA' }), (error) =>
      error.code === 'ECONNRESET' && error.responseReceived === false && checked);
    assert.equal(upstreamCalls, 1); assert.equal(proxy.attempts.length, 1);
    assert.deepEqual(proxy.attempts[0], { number: 1, upstreamStatus: 200,
      acknowledgementDropped: true, commit: { messageId: 'message-1', messageCount: 1 } });
    const retry = await postJsonWithoutRetry(proxy.url, 'LOCAL_TEST_ONLY', { body: 'QA' });
    assert.equal(retry.status, 200); assert.equal(retry.json.result.messageId, 'message-1');
    assert.equal(retry.responseReceived, true); assert.equal(upstreamCalls, 2);
    assert.equal(proxy.attempts[1].acknowledgementDropped, false);
    assert(!JSON.stringify(proxy.attempts).includes('LOCAL_TEST_ONLY'));
  } finally { if (proxy) await proxy.close(); await stop(); }
});

test('failed independent verification is not represented as a successful post-commit dropped acknowledgement', async () => {
  const stop = await upstream((request, response) => {
    request.resume(); response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ result: { messageId: 'unverified' } }));
  });
  let proxy;
  try {
    proxy = await openPostCommitLossProxy(target, async () => { throw new Error('Not independently committed'); });
    const failed = await postJsonWithoutRetry(proxy.url, 'LOCAL_TEST_ONLY', {});
    assert.equal(failed.status, 502); assert.equal(failed.responseReceived, true);
    assert.equal(failed.json.error.status, 'INTERNAL');
    assert.equal(proxy.attempts[0].acknowledgementDropped, false);
    assert.equal(proxy.attempts[0].commit, undefined);
  } finally { if (proxy) await proxy.close(); await stop(); }
});

test('the real service scenario remains mandatory, persisted, denied to outsiders and explicitly non-native', () => {
  const suite = read('scripts/qa/local-flow-suite.mjs'), runner = read('scripts/qa/run-local-flows.mjs');
  assert.match(suite, /check\('chat-post-commit-response-loss'/);
  assert.match(runner, /result.steps.length, 20/);
  assert.match(runner, /result.chatResponseLoss\?\.firstError.code, 'ECONNRESET'/);
  const check = read('scripts/qa/local-chat-response-loss.mjs');
  for (const value of ['original.createdAtMillis', 'original.notificationId', 'conflict.status, 409',
    "'PERMISSION_DENIED'", 'unreadCount, 0', 'no native composer', 'finally { await proxy.close(); }']) assert(check.includes(value));
  const workflow = read('.github/workflows/web-integration-smoke.yml');
  assert.equal(workflow.split('"tests/local-chat-response-loss.test.mjs"').length - 1, 2);
  assert(workflow.includes('node --test tests/local-chat-response-loss.test.mjs'));
});

test('retained service evidence proves a saved message before the reset without accepting native or physical retry scope', () => {
  const directory = 'docs/release/evidence/local-chat-response-loss-2026-10-16/';
  const runs = ['first-pass.json', 'results.json'].map((file) => JSON.parse(read(directory + file)));
  assert.notEqual(runs[0].runId, runs[1].runId);
  assert.equal(runs[1].runId, '0ab00e5e7949d11752e4d6912454cd31');
  for (const run of runs) {
    assert.equal(run.projectId, 'demo-sgm-local-qa'); assert.equal(run.scope, 'local-emulated-services-not-phone-ui');
    assert.equal(run.steps.length, 18); assert(run.steps.every((step) => step.status === 'passed'));
    assert(run.steps.some((step) => step.id === 'chat-post-commit-response-loss'));
    const fault = run.chatResponseLoss;
    assert.equal(fault.method, 'http-response-discarded-after-independent-commit-verification');
    assert.deepEqual(fault.firstError, { code: 'ECONNRESET', responseReceived: false });
    assert.equal(fault.attempts.length, 4);
    assert.deepEqual(fault.attempts.map((item) => item.upstreamStatus), [200, 200, 200, 409]);
    assert.deepEqual(fault.attempts.map((item) => item.acknowledgementDropped), [true, false, false, false]);
    const commit = fault.attempts[0].commit;
    assert.equal(commit.messageCount, 1); assert.equal(commit.notificationCount, 1);
    assert.equal(commit.recipientUserId, 'sgm-qa-driver');
    assert.equal(fault.messageId, commit.messageId); assert.equal(fault.notificationId, commit.notificationId);
    assert.equal(fault.createdAtMillis, commit.createdAtMillis);
    assert.equal(fault.messageCount, 1); assert.equal(fault.notificationCount, 1);
    assert.equal(fault.duplicateMessages, 0); assert.equal(fault.unreadAfterRead, 0);
    assert(fault.changedBodyRejected && fault.outsiderRejected);
    assert(fault.limits.some((limit) => limit.includes('no native composer')));
  }
  const flow = content.flows.find((item) => item.id === 'messages');
  assert.equal(flow.status, 'partial'); assert.equal(flow.local.source, directory + 'results.json');
  assert(flow.local.groups.includes('chat-post-commit-response-loss'));
  assert.equal(flow.ui.source, 'docs/release/evidence/local-native-chat-loss-2026-10-16/results.json');
  assert(!flow.ui.groups.includes('chat-post-commit-response-loss'));
  assert.match(flow.remaining, /coupures réelles pendant l’envoi/);
  assert.match(read(directory + 'README.md'), /not a native retry/);
});

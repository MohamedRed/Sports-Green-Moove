import assert from 'node:assert/strict';
import { once } from 'node:events';
import http from 'node:http';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { faultMessage, openNativeChatLossProxy } from '../scripts/qa/native-chat-loss-proxy.mjs';
import { postJsonWithoutRetry } from '../scripts/qa/post-commit-loss-proxy.mjs';

const origin = 'http://127.0.0.1:5001/demo-sgm-local-qa/us-central1';
const runId = 'a'.repeat(32), bookingId = 'qa-booking';
const config = { origin, runId, bookingId };
const input = { bookingId, body: faultMessage, clientMessageId: '11111111-1111-1111-1111-111111111111' };
const read = (file) => readFileSync(new URL('../' + file, import.meta.url), 'utf8');
async function stub() {
  const calls = [];
  const server = http.createServer(async (request, response) => {
    calls.push(request.url); request.resume();
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ result: request.url.endsWith('sendChatMessage') ? { messageId: 'saved' } : { conversation: {} } }));
  });
  server.listen(5001, '127.0.0.1'); await once(server, 'listening');
  return { calls, async close() { const closed = once(server, 'close'); server.close(); server.closeAllConnections(); await closed; } };
}
async function phase(proxy, value, id = runId) {
  return fetch(`http://127.0.0.1:${proxy.port}/__qa/phase`, { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ runId: id, phase: value }) });
}
const url = (proxy, name = 'sendChatMessage') => `http://127.0.0.1:${proxy.port}/demo-sgm-local-qa/us-central1/${name}`;

test('native fault proxy refuses alternate projects, origins and invalid run receipts before listening', async () => {
  for (const candidate of [origin.replace('demo-sgm-local-qa', 'sports-green-moove-prod'),
    origin.replace('127.0.0.1', 'localhost'), 'https://example.com', origin + '?redirect=1'])
    await assert.rejects(openNativeChatLossProxy({ ...config, origin: candidate }, () => {}));
  await assert.rejects(openNativeChatLossProxy({ ...config, runId: 'old' }, () => {}));
});

test('automatic transport repeats stay in the loss phase; rejection and recovery require explicit ordered controls', async () => {
  const upstream = await stub(); let checks = 0;
  const proxy = await openNativeChatLossProxy(config, async (messageId, sent) => {
    checks++; assert.deepEqual(sent, input); return { messageId, messageCount: 1, notificationCount: 1 };
  });
  try {
    for (let i = 0; i < 2; i++) await assert.rejects(postJsonWithoutRetry(url(proxy), 'LOCAL_ONLY', input), (error) =>
      error.code === 'ECONNRESET' && error.responseReceived === false);
    assert.equal(checks, 2); assert.equal(proxy.receipt.phase, 'loss');
    assert(proxy.receipt.attempts.every((attempt) => attempt.acknowledgementDropped));
    assert.equal((await phase(proxy, 'reject')).status, 200);
    const rejected = await postJsonWithoutRetry(url(proxy), 'LOCAL_ONLY', input);
    assert.equal(rejected.status, 429); assert.equal(rejected.json.error.status, 'RESOURCE_EXHAUSTED');
    assert.equal(upstream.calls.length, 2, 'The rejection is injected, not a new server commit');
    assert.equal((await phase(proxy, 'recover')).status, 200);
    const recovered = await postJsonWithoutRetry(url(proxy), 'LOCAL_ONLY', input);
    assert.equal(recovered.status, 200); assert.equal(recovered.json.result.messageId, 'saved');
    assert.equal(checks, 3); assert.equal(proxy.receipt.attempts.length, 4);
    assert.equal(new Set(proxy.receipt.attempts.map((attempt) => attempt.clientMessageId)).size, 1);
    assert(!JSON.stringify(proxy.receipt).includes('LOCAL_ONLY'));
  } finally { await proxy.close(); await upstream.close(); }
});

test('unverified commits, changed intents, skipped/stale controls and non-allowlisted calls cannot look like a successful loss', async () => {
  const upstream = await stub();
  const proxy = await openNativeChatLossProxy(config, async () => { throw new Error('Not saved'); });
  try {
    assert.equal((await phase(proxy, 'recover')).status, 502);
    assert.equal((await phase(proxy, 'reject', 'b'.repeat(32))).status, 502);
    const unverified = await postJsonWithoutRetry(url(proxy), 'LOCAL_ONLY', input);
    assert.equal(unverified.status, 502); assert.equal(proxy.receipt.attempts[0].acknowledgementDropped, false);
    const changed = await postJsonWithoutRetry(url(proxy), 'LOCAL_ONLY', { ...input, clientMessageId: '22222222-2222-2222-2222-222222222222' });
    assert.equal(changed.status, 502); assert.equal(upstream.calls.length, 1);
    assert.equal((await postJsonWithoutRetry(url(proxy, 'createTrip'), 'LOCAL_ONLY', input)).status, 502);
    assert(proxy.receipt.failed);
  } finally { await proxy.close(); await upstream.close(); }
});

test('authorization and read calls are forwarded only for the selected booking, without exposing tokens', async () => {
  const upstream = await stub(), proxy = await openNativeChatLossProxy(config, () => {});
  try {
    for (const name of ['getChatConversation', 'markChatMessagesRead']) {
      assert.equal((await postJsonWithoutRetry(url(proxy, name), 'LOCAL_ONLY', { sourceType: 'booking', sourceId: bookingId })).status, 200);
      assert.equal((await postJsonWithoutRetry(url(proxy, name), 'LOCAL_ONLY', { sourceType: 'booking', sourceId: 'other' })).status, 502);
    }
    assert.equal(upstream.calls.length, 2); assert.equal(proxy.receipt.attempts.length, 0);
  } finally { await proxy.close(); await upstream.close(); }
});

test('the SDK case is mandatory before OS network disruption and preserves earlier coverage', () => {
  const runner = read('scripts/qa/local-android-session.mjs');
  assert(runner.indexOf('await replayChatLossUi(') > runner.indexOf('await verifyChatRestartUi('));
  assert(runner.indexOf('await replayChatLossUi(') < runner.indexOf('replayWithNetworkCleanup(adb'));
  assert.match(runner, /testCount: 36/); assert.match(runner, /'chat-post-commit-response-loss-ui'/);
  const native = read('android/app/src/androidTest/java/be/sportgreenmoove/app/ui/LocalChatResponseLossTest.kt');
  for (const text of ['SGM_USE_FIREBASE_EMULATOR', 'disposableEmulator', 'ro.kernel.qemu', 'demo-sgm-local-qa',
    'FirebaseAndroidConversationGateway(firestore, functions, auth)', 'ConversationRoute(', 'firestore.disableNetwork().await()',
    'firestore.enableNetwork().await()', 'phase(port, session.getString("runId"), "reject")',
    'phase(port, session.getString("runId"), "recover")']) assert(native.includes(text));
  assert(!native.includes('UiFlowConversationGateway'));
  const worker = read('scripts/qa/native-chat-loss-worker.mjs');
  for (const text of ['messages.size, 1', 'notes.size, 1', "'sgm-qa-parent'", "'sgm-qa-driver'", 'data.createdAt.toMillis()',
    "process.on('disconnect'", 'await proxy.close()', 'await db.terminate()']) assert(worker.includes(text));
  const workflow = read('.github/workflows/web-integration-smoke.yml');
  assert.equal(workflow.split('"tests/native-chat-loss.test.mjs"').length - 1, 2);
  assert(workflow.includes('node --test tests/native-chat-loss.test.mjs'));
});

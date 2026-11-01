import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {parse} from 'yaml';
import {openChatReceiptLossProxy} from '../scripts/qa/chat-receipt-loss-proxy.mjs';
import {chatNetworkPhoneBodies} from '../scripts/qa/chat-network-phone-checkpoints.mjs';

const runId = 'b'.repeat(32), prefix = '/demo-sgm-local-qa/us-central1/';
const data = {bookingId: 'isolated-booking', body: chatNetworkPhoneBodies.parent,
  clientMessageId: '11111111-1111-4111-8111-111111111111'};
const actors = ['sgm-qa-parent', 'sgm-qa-driver'];
const messageId = createHash('sha256').update(JSON.stringify([actors[0], data.clientMessageId])).digest('hex');
async function fixture(t, options = {}) {
  const calls = [], records = new Map(); let commitChecks = 0;
  const upstream = createServer((request, response) => {
    void (async () => {
      let body = ''; for await (const chunk of request) body += chunk;
      const input = JSON.parse(body); calls.push({method: request.url.slice(prefix.length), input});
      let result = {};
      if (request.url === prefix + 'sendChatMessage') {
        const reused = records.has(messageId);
        if (!reused) records.set(messageId, {createdAt: new Date().toISOString(), data: input.data});
        result = {messageId, participantUserIds: actors, reused};
      }
      response.writeHead(options.upstreamStatus ?? 200, {'content-type': 'application/json'});
      response.end(JSON.stringify({result}));
    })().catch(() => {response.writeHead(500); response.end('{}');});
  });
  upstream.listen(0, '127.0.0.1'); await once(upstream, 'listening');
  const proxy = await openChatReceiptLossProxy({runId, port: 0, upstreamPort: upstream.address().port,
    verifyIdentity: async token => {assert.equal(token, 'private-fixture-token'); return {uid: options.uid ?? actors[0]};},
    verifyCommit: async (id, intent) => {
      commitChecks++; assert.equal(id, messageId); assert.deepEqual(intent, data); assert(records.has(id));
      if (options.rejectCommit) throw new Error('Unverified commit');
      return {messageId: id, originalRecordPreserved: true, messageCount: 1, notificationCount: 1};
    }});
  t.after(async () => {await proxy.close(); const closed = once(upstream, 'close'); upstream.close(); upstream.closeAllConnections(); await closed;});
  const send = (method = 'sendChatMessage', input = data, overrides = {}) => fetch(`http://127.0.0.1:${proxy.port}${prefix}${method}`, {
    method: 'POST', signal: AbortSignal.timeout(2000), body: JSON.stringify({data: input}),
    headers: {'content-type': 'application/json', authorization: 'Bearer private-fixture-token', connection: 'close'}, ...overrides});
  return {proxy, send, calls, records, commitChecks: () => commitChecks};
}
test('a verified commit loses its reply; blocked retries and recovery preserve the first identity and timestamp', async t => {
  const {proxy, send, calls, records, commitChecks} = await fixture(t); proxy.arm({bookingId: data.bookingId});
  await assert.rejects(send, TypeError);
  assert.equal(records.size, 1); const original = structuredClone(records.get(messageId));
  assert.equal(commitChecks(), 1); assert.equal(proxy.receipt.phase, 'lost');
  assert.equal(proxy.receipt.attempts[0].commitIndependentlyVerified, true);
  assert.equal(proxy.receipt.attempts[0].responseReleased, false);
  await assert.rejects(send, TypeError); assert.equal(calls.length, 1); assert.equal(commitChecks(), 1);
  assert.equal(proxy.receipt.attempts[1].blockedBeforeForwarding, true);
  assert.equal((await send('getChatConversation', {sourceType: 'booking', sourceId: data.bookingId})).status, 200);
  proxy.recover(); assert.equal((await send()).status, 200);
  assert.equal(records.size, 1); assert.deepEqual(records.get(messageId), original); assert.equal(commitChecks(), 2);
  assert.equal(proxy.receipt.attempts.at(-1).responseReleased, true); assert.equal(proxy.receipt.failed, false);
  assert(!JSON.stringify(proxy.receipt).includes('private-fixture-token'));
});
test('the live listener may reconcile the commit without forcing a second send', async t => {
  const {proxy, send, calls} = await fixture(t); proxy.arm({bookingId: data.bookingId});
  await assert.rejects(send, TypeError); proxy.recover();
  assert.equal(calls.length, 1); assert.equal(proxy.receipt.attempts.length, 1); assert.equal(proxy.receipt.failed, false);
});
test('native Messages can load both the notification inbox and eligible booking directory', async t => {
  const {proxy, send, calls} = await fixture(t); proxy.arm({bookingId: data.bookingId});
  for (const method of ['getNotificationInbox', 'listChatConversations', 'listChatBookingOptions']) {
    assert.equal((await send(method, {})).status, 200); assert.equal(proxy.receipt.failed, false);
  }
  assert.equal(calls.length, 3); assert.equal(proxy.receipt.attempts.length, 0);
  const directory = readFileSync(new URL('../android/app/src/main/java/be/sportgreenmoove/app/services/FirebaseAndroidConversationDirectory.kt', import.meta.url), 'utf8');
  const inbox = readFileSync(new URL('../android/app/src/main/java/be/sportgreenmoove/app/services/FirebaseAndroidNotificationInboxGateway.kt', import.meta.url), 'utf8');
  assert.match(directory, /call\("listChatBookingOptions", cursor\)/);
  assert.match(inbox, /getHttpsCallable\("getNotificationInbox"\)/);
});
for (const [name, method, input, overrides] of [
  ['changed booking', 'sendChatMessage', {...data, bookingId: 'foreign'}],
  ['changed body', 'sendChatMessage', {...data, body: 'another message'}],
  ['missing identity', 'sendChatMessage', {bookingId: data.bookingId, body: data.body}],
  ['non-UUID identity', 'sendChatMessage', {...data, clientMessageId: 'x'.repeat(36)}],
  ['unapproved payload key', 'sendChatMessage', {...data, rideSessionId: 'foreign'}],
  ['another mutation', 'cancelTrip', {}],
  ['foreign conversation', 'getChatConversation', {sourceType: 'booking', sourceId: 'foreign'}],
  ['foreign read acknowledgement', 'markChatMessagesRead', {sourceType: 'booking', sourceId: data.bookingId, messageIds: ['foreign']}],
  ['oversized input', 'sendChatMessage', {...data, body: 'x'.repeat(17_000)}],
  ['missing authentication', 'sendChatMessage', data, {headers: {connection: 'close'}}],
]) test('fails closed before forwarding: ' + name, async t => {
  const {proxy, send, calls} = await fixture(t); proxy.arm({bookingId: data.bookingId});
  assert.equal((await send(method, input, overrides)).status, 502); assert.equal(calls.length, 0);
  assert.equal(proxy.receipt.failed, true); assert.throws(() => proxy.recover());
  assert.equal((await send('getInbox', {})).status, 502); assert.equal(calls.length, 0);
});
for (const uid of ['sgm-qa-driver', 'sgm-qa-outsider']) test('cannot send as ' + uid, async t => {
  const {proxy, send, calls} = await fixture(t, {uid}); proxy.arm({bookingId: data.bookingId});
  assert.equal((await send()).status, 502); assert.equal(calls.length, 0);
});
test('changing the UUID after commit cannot reach upstream or replace the original intent', async t => {
  const {proxy, send, calls} = await fixture(t); proxy.arm({bookingId: data.bookingId});
  await assert.rejects(send, TypeError); proxy.recover();
  assert.equal((await send('sendChatMessage', {...data, clientMessageId: '22222222-2222-4222-8222-222222222222'})).status, 502);
  assert.equal(calls.length, 1); assert.equal(proxy.receipt.failed, true);
});
for (const options of [{rejectCommit: true}, {upstreamStatus: 500}]) test('an unverified result cannot become post-commit proof: ' + JSON.stringify(options), async t => {
  const {proxy, send} = await fixture(t, options); proxy.arm({bookingId: data.bookingId});
  assert.equal((await send()).status, 502); assert.equal(proxy.receipt.phase, 'armed');
  assert.equal(proxy.receipt.attempts.length, 0); assert.equal(proxy.receipt.failed, true);
});
test('preparation and recovery cannot be skipped, repeated or exposed through an HTTP control route', async t => {
  const {proxy, send, calls} = await fixture(t);
  assert.throws(() => proxy.recover());
  assert.equal((await send('createTrip', {})).status, 502); assert.equal(calls.length, 0);
  await assert.rejects(openChatReceiptLossProxy({runId, port: 4185, verifyIdentity() {}, verifyCommit() {}}));
  const fresh = await fixture(t); fresh.proxy.arm({bookingId: data.bookingId});
  assert.throws(() => fresh.proxy.arm({bookingId: data.bookingId})); assert.throws(() => fresh.proxy.recover());
  assert.equal((await fresh.send('__qa/phase', {phase: 'recover'})).status, 502); assert.equal(fresh.calls.length, 0);
});
test('unrecognised request diagnostics contain neither arbitrary payloads nor authentication', async t => {
  const {proxy, send} = await fixture(t);
  assert.equal((await send('private-person@example.test', {private: 'sensitive'})).status, 502);
  const diagnostic = JSON.stringify(proxy.receipt);
  for (const value of ['private-person', 'sensitive', 'private-fixture-token']) assert(!diagnostic.includes(value));
});
test('manual observer never sends messages and uses existing four-port runtime without added routing', () => {
  const source = readFileSync(new URL('../scripts/qa/manual-chat-receipt-loss-session.mjs', import.meta.url), 'utf8');
  assert(!/call\(['"]sendChatMessage/.test(source)); assert.match(source, /process.stdin.isTTY/);
  for (const flag of ['controllerSubmittedChatMessages', 'phoneUiProvenByObserver', 'physicalRadioLossProvenByObserver',
    'installedBytesIndependentlyVerified', 'productionWrites', 'realPayments']) assert(source.includes(flag + ': false'));
  assert.match(source, /sourceFilesUnchanged/); assert.match(source, /assert.deepEqual\(data, before/);
  const workflow = parse(readFileSync(new URL('../.github/workflows/web-integration-smoke.yml', import.meta.url), 'utf8'));
  for (const event of ['push', 'pull_request']) assert(workflow.on[event].paths.includes('tests/chat-receipt-loss*.test.mjs'));
  const steps = workflow.jobs.smoke.steps.filter(row => row.name === 'Test post-commit chat confirmation loss guards');
  assert.equal(steps.length, 1);
  assert.equal(steps[0].run, 'node --test tests/chat-receipt-loss-proxy.test.mjs tests/chat-receipt-loss-checkpoints.test.mjs');
});

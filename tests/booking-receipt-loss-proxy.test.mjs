import assert from 'node:assert/strict';
import {once} from 'node:events';
import {createServer} from 'node:http';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {parse} from 'yaml';
import {openBookingReceiptLossProxy} from '../scripts/qa/booking-receipt-loss-proxy.mjs';

const prefix = '/demo-sgm-local-qa/us-central1/', tripId = 'sgm-qa-trip-u8-wavre-bruxelles';
const data = {tripId, seats: 1, requesterUserId: 'sgm-qa-parent', clientRequestId: '78179ff1-03c5-4053-9681-6bf3b53ecdd3',
  expectedBookingIntent: {terms: 'fixed-isolated-trip'}};
async function fixture(t, uid = 'sgm-qa-parent') {
  const calls = [], records = new Map();
  const upstream = createServer((request, response) => {void (async () => {
    let body = ''; for await (const chunk of request) body += chunk;
    const input = JSON.parse(body).data; calls.push({url: request.url, input});
    if (request.url === prefix + 'requestBooking' && !records.has(input.clientRequestId))
      records.set(input.clientRequestId, {bookingId: 'booking-isolated', createdAt: new Date().toISOString()});
    const result = request.url === prefix + 'requestBooking'
      ? {bookingId: 'booking-isolated', clientRequestId: input.clientRequestId, status: 'requested', currentBookingStatus: 'requested', trip: {id: tripId}}
      : {bookings: []};
    response.writeHead(200, {'content-type': 'application/json'}); response.end(JSON.stringify({result}));
  })().catch(() => {response.writeHead(500); response.end('{}');});});
  upstream.listen(0, '127.0.0.1'); await once(upstream, 'listening');
  const proxy = await openBookingReceiptLossProxy({runId: 'b'.repeat(32), port: 0, upstreamPort: upstream.address().port,
    verifyIdentity: async token => {assert.equal(token, 'isolated-booking-token'); return {uid};},
    verifyIntent: intent => {assert.deepEqual(intent, data.expectedBookingIntent); return 'a'.repeat(64);},
    afterCommit: async (bookingId, clientRequestId) => {
      assert.equal(records.size, 1); const original = records.get(clientRequestId); assert.equal(original.bookingId, bookingId);
      return {bookingId, clientRequestId, createdAt: original.createdAt, bookingCount: 1};
    }});
  t.after(async () => {await proxy.close(); const closed = once(upstream, 'close'); upstream.close(); upstream.closeAllConnections(); await closed;});
  const send = (method = 'requestBooking', value = data, options = {}) => fetch(`http://127.0.0.1:${proxy.port}${prefix}${method}`, {
    method: 'POST', headers: {'content-type': 'application/json', authorization: 'Bearer isolated-booking-token', connection: 'close'},
    signal: AbortSignal.timeout(2000), body: JSON.stringify({data: value}), ...options});
  return {proxy, send, calls, records, arm: () => proxy.arm({tripId, intentRevision: 'a'.repeat(64)})};
}
test('the real loopback server commits before withholding; explicit retry keeps the exact request and original record', async t => {
  const {proxy, send, calls, records, arm} = await fixture(t); arm();
  await assert.rejects(send, TypeError); assert.equal(proxy.receipt.phase, 'lost');
  const first = structuredClone(records.get(data.clientRequestId)); assert(first); assert.equal(calls.length, 1);
  await assert.rejects(send, TypeError); assert.equal(calls.length, 1);
  assert.equal(proxy.receipt.attempts.at(-1).blockedBeforeForwarding, true);
  assert.equal((await send('listReservations', {role: 'parent'})).status, 200);
  proxy.recover(); const recovered = await send(); assert.equal(recovered.status, 200);
  assert.equal((await recovered.json()).result.clientRequestId, data.clientRequestId);
  assert.equal(records.size, 1); assert.deepEqual(records.get(data.clientRequestId), first);
  const acknowledgements = proxy.receipt.attempts.filter(row => row.upstreamAcknowledged);
  assert.deepEqual(acknowledgements.map(row => row.responseReleased), [false, true]);
  assert.deepEqual(acknowledgements[0].commit, acknowledgements[1].commit);
  assert.equal(acknowledgements[0].requestSha256, acknowledgements[1].requestSha256);
  assert.equal(proxy.receipt.failed, false); assert(!JSON.stringify(proxy.receipt).includes('isolated-booking-token'));
});
for (const [name, method, change, options] of [
  ['another trip', 'requestBooking', {tripId: 'other'}],
  ['another requester', 'requestBooking', {requesterUserId: 'other'}],
  ['a child booking', 'requestBooking', {childId: 'sgm-qa-child-lina'}],
  ['two seats', 'requestBooking', {seats: 2}],
  ['another trip intent', 'requestBooking', {expectedBookingIntent: {terms: 'changed'}}],
  ['an invalid request identity', 'requestBooking', {clientRequestId: 'invented'}],
  ['a cancellation', 'cancelBooking', {}],
  ['an unsigned request', 'requestBooking', {}, {headers: {'content-type': 'application/json'}}],
  ['an oversized body', 'requestBooking', {extra: 'x'.repeat(17_000)}],
]) test('rejects ' + name + ' without an upstream mutation', async t => {
  const {proxy, send, records, calls, arm} = await fixture(t); arm();
  assert.equal((await send(method, {...data, ...change}, options)).status, 502);
  assert.equal(proxy.receipt.failed, true); assert.equal(records.size, 0); assert.equal(calls.length, 0);
});
test('even a well-formed new request identity cannot replace the committed one after recovery', async t => {
  const {proxy, send, records, calls, arm} = await fixture(t); arm(); await assert.rejects(send, TypeError); proxy.recover();
  assert.equal((await send('requestBooking', {...data, clientRequestId: '92d78c41-1977-47af-b714-7ae36b56f36b'})).status, 502);
  assert.equal(calls.length, 1); assert.equal(records.size, 1); assert.equal(proxy.receipt.failed, true);
});
test('another actor, setup-phase booking and unknown request paths fail closed', async t => {
  const driver = await fixture(t, 'sgm-qa-driver'); driver.arm();
  assert.equal((await driver.send()).status, 502); assert.equal(driver.calls.length, 0);
  const setup = await fixture(t); assert.equal((await setup.send()).status, 502); assert.equal(setup.calls.length, 0);
  const unknown = await fixture(t); unknown.arm(); assert.equal((await unknown.send('private-contact@example.test')).status, 502);
  assert.equal(unknown.proxy.receipt.requests[0].method, 'unrecognised');
  assert(!JSON.stringify(unknown.proxy.receipt).includes('private-contact'));
});
test('the independent observer cannot submit and preserves original documents, claims and timestamps', () => {
  const source = readFileSync(new URL('../scripts/qa/manual-booking-receipt-loss-session.mjs', import.meta.url), 'utf8');
  assert(!/call\(['"]requestBooking/.test(source)); assert(source.includes('assert.deepEqual(state, firstCommittedState)'));
  assert(source.includes('sourceFilesUnchanged')); assert(source.includes('controllerSubmittedBooking: false'));
  assert(source.includes('processRestartProvenByObserver: false')); assert(source.includes('phoneUiProvenByObserver: false'));
});
test('web smoke runs the isolated guards, not a phone session or a booking fixture', () => {
  const source = readFileSync(new URL('../.github/workflows/web-integration-smoke.yml', import.meta.url), 'utf8');
  assert.equal(source.split('"tests/booking-receipt-loss-proxy.test.mjs"').length - 1, 2);
  const step = parse(source).jobs.smoke.steps.filter(row => row.name === 'Test isolated booking reply-loss guards');
  assert.equal(step.length, 1);
  assert.equal(step[0].run, 'node --test tests/booking-receipt-loss-proxy.test.mjs tests/booking-receipt-phone-evidence.test.mjs tests/booking-receipt-checkpoint-plan.test.mjs tests/booking-before-ack-phone-evidence.test.mjs');
});

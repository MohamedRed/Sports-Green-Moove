import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {readFileSync} from 'node:fs';
import {parse} from 'yaml';
import test from 'node:test';
import {openReviewReceiptLossProxy} from '../scripts/qa/review-receipt-loss-proxy.mjs';

const runId = 'a'.repeat(32), data = {rideSessionId: 'sgm-receipt-loss-29', ratedUserId: 'sgm-qa-driver', score: 5};
const ratingId = `${data.rideSessionId}_sgm-qa-parent_sgm-qa-driver`;
const chosen = {uid: 'sgm-qa-parent', data, ratingId};
const prefix = '/demo-sgm-local-qa/us-central1/';
async function fixture(t, uid = chosen.uid) {
  const calls = [], records = new Map();
  const upstream = createServer((request, response) => {
    void (async () => {
      let bytes = ''; for await (const chunk of request) bytes += chunk;
      const input = JSON.parse(bytes); calls.push({url: request.url, input});
      let result;
      if (request.url === prefix + 'submitRating') {
        assert.deepEqual(input, {data});
        if (!records.has(ratingId)) records.set(ratingId, {score: data.score, createdAt: new Date().toISOString()});
        result = {ratingId};
      } else result = {userId: 'sgm-qa-parent', count: records.size};
      response.writeHead(200, {'content-type': 'application/json'}); response.end(JSON.stringify({result}));
    })().catch(() => {response.writeHead(500); response.end('{}');});
  });
  upstream.listen(0, '127.0.0.1'); await once(upstream, 'listening');
  const proxy = await openReviewReceiptLossProxy({runId, port: 0, upstreamPort: upstream.address().port,
    verifyIdentity: async token => {assert.equal(token, 'isolated-parent-token'); return {uid};}});
  t.after(async () => {await proxy.close(); const closed = once(upstream, 'close'); upstream.close(); upstream.closeAllConnections(); await closed;});
  const send = (method = 'submitRating', input = data, options = {}) => fetch(`http://127.0.0.1:${proxy.port}${prefix}${method}`, {
    method: 'POST', signal: AbortSignal.timeout(2000), headers: {'content-type': 'application/json', authorization: 'Bearer isolated-parent-token', connection: 'close'},
    body: JSON.stringify({data: input}), ...options,
  });
  return {proxy, records, calls, send};
}
test('real loopback forwarding commits before dropping the reply; explicit release preserves the original record', async t => {
  const {proxy, records, calls, send} = await fixture(t); proxy.arm(chosen);
  await assert.rejects(send, TypeError); assert.equal(proxy.receipt.phase, 'lost');
  const original = structuredClone(records.get(ratingId)); assert(original); assert.equal(calls.length, 1);
  assert.equal(proxy.receipt.attempts[0].upstreamAcknowledged, true); assert.equal(proxy.receipt.attempts[0].responseReleased, false);
  await assert.rejects(send, TypeError); assert.equal(calls.length, 1);
  assert.equal(proxy.receipt.attempts[1].blockedBeforeForwarding, true);
  const inbox = await send('getInbox', {}); assert.equal(inbox.status, 200);
  assert.deepEqual((await inbox.json()).result, {userId: chosen.uid, count: 1});
  proxy.recover(); const recovered = await send(); assert.equal(recovered.status, 200);
  assert.deepEqual(await recovered.json(), {result: {ratingId}}); assert.equal(records.size, 1);
  assert.deepEqual(records.get(ratingId), original); assert.equal(proxy.receipt.failed, false);
  assert.equal(proxy.receipt.attempts.at(-1).responseReleased, true);
  assert(!JSON.stringify(proxy.receipt).includes('isolated-parent-token'));
});
test('the driver account can load its booking requests without aborting its atomic profile refresh', async t => {
  const {proxy, calls, send} = await fixture(t, 'sgm-qa-driver'); proxy.arm(chosen);
  const response = await send('listDriverBookingRequests', {});
  assert.equal(response.status, 200); assert.equal(calls.length, 1); assert.equal(proxy.receipt.failed, false);
  assert.deepEqual(proxy.receipt.requests, [{method: 'listDriverBookingRequests', phase: 'armed', upstreamStatus: 200, failed: false}]);
});
test('all callable reads in the native account refresh remain visible without changing the selected fault', async t => {
  const {proxy, send, calls} = await fixture(t); proxy.arm(chosen);
  for (const method of ['initializeUserProfile', 'getActiveRide', 'getProfileCity', 'getImpactSummary',
    'getRewardSummary', 'getReceivedRatingSummary', 'getInbox', 'getPendingReviews', 'listChatConversations', 'listDriverBookingRequests']) {
    assert.equal((await send(method, {})).status, 200, method);
  }
  assert.equal(calls.length, 10); assert.equal(proxy.receipt.phase, 'armed'); assert.equal(proxy.receipt.failed, false);
  assert.equal(proxy.receipt.attempts.length, 0);
});
test('rejected diagnostics never retain arbitrary paths, payloads or authentication values', async t => {
  const {proxy, send} = await fixture(t); proxy.arm(chosen);
  assert.equal((await send('private-contact@example.test', {secret: 'private-value'})).status, 502);
  assert.deepEqual(proxy.receipt.requests, [{method: 'unrecognised', phase: 'armed', upstreamStatus: null, failed: true}]);
  const text = JSON.stringify(proxy.receipt);
  for (const value of ['private-contact', 'private-value', 'isolated-parent-token']) assert(!text.includes(value));
});
for (const [name, method, input, options] of [
  ['another score', 'submitRating', {...data, score: 4}],
  ['another trip', 'submitRating', {...data, rideSessionId: 'sgm-receipt-loss-other'}],
  ['an added comment', 'submitRating', {...data, comment: 'changed'}],
  ['another target', 'submitRating', {...data, ratedUserId: 'other'}],
  ['another mutation', 'cancelTrip', {}],
  ['missing authentication', 'submitRating', data, {headers: {'content-type': 'application/json'}}],
  ['an over-limit body', 'submitRating', {...data, extra: 'x'.repeat(17_000)}],
]) test('rejects ' + name + ' before any upstream write', async t => {
  const {proxy, records, calls, send} = await fixture(t); proxy.arm(chosen);
  const response = await send(method, input, options); assert.equal(response.status, 502);
  assert.equal(records.size, 0); assert.equal(calls.length, 0); assert.equal(proxy.receipt.failed, true);
});
test('ratings cannot pass during setup and state transitions cannot be guessed or repeated', async t => {
  const {proxy, calls, send} = await fixture(t);
  assert.throws(() => proxy.recover()); assert.equal((await send()).status, 502); assert.equal(calls.length, 0);
  proxy.arm(chosen); assert.throws(() => proxy.arm(chosen)); assert.throws(() => proxy.recover());
});
test('the proxy cannot bind arbitrary hosts or forward to another project or network origin', async t => {
  await assert.rejects(openReviewReceiptLossProxy({runId: 'invalid', verifyIdentity() {}}));
  await assert.rejects(openReviewReceiptLossProxy({runId, port: 9099, verifyIdentity() {}}));
  const {proxy, calls} = await fixture(t); proxy.arm(chosen);
  const response = await fetch(`http://127.0.0.1:${proxy.port}/sports-green-moove-prod/us-central1/submitRating`, {
    method: 'POST', body: '{}', headers: {connection: 'close'}, signal: AbortSignal.timeout(2000)});
  assert.equal(response.status, 502); assert.equal(calls.length, 0);
});
test('the dedicated runtime preserves the existing app and tunnel ports without a production endpoint', () => {
  const source = readFileSync(new URL('../scripts/qa/start-review-receipt-loss-runtime.mjs', import.meta.url), 'utf8');
  assert.match(source, /config\.emulators\.functions\.port = 5002/);
  assert.match(source, /host: '127\.0\.0\.1', port: 5001/);
  assert.match(source, /await assertLocalEndpointsClosed\(ports\);\n  runtime\?\.cleanup\(\)/);
  assert(!source.includes('BROWSERSTACK_ACCESS_KEY')); assert(!source.includes('SGM_FIREBASE_EMULATOR_HOST'));
  const local = readFileSync(new URL('../scripts/qa/local-emulator-config.mjs', import.meta.url), 'utf8');
  assert.match(local, /http:\/\/127\.0\.0\.1:5001/);
});
test('the observer cannot send a rating, change the receipt or infer phone UI from stored records', () => {
  const source = readFileSync(new URL('../scripts/qa/manual-review-receipt-loss-session.mjs', import.meta.url), 'utf8');
  assert(!/call\(['"]submitRating/.test(source)); assert.match(source, /process.stdin.isTTY/);
  assert.match(source, /assert.deepEqual\(row, firstRating/); assert.match(source, /assert.deepEqual\(paths.sort\(\)/);
  assert.match(source, /fixtureSubmittedRatings: 0/); assert.match(source, /controllerSubmittedRatings: false/);
  assert.match(source, /phoneUiProvenByObserver: false/); assert.match(source, /installedBytesIndependentlyVerified: false/);
  assert.match(source, /const sourceFiles = hashSources\(\)/); assert.match(source, /sourceFilesUnchanged/);
});
test('both smoke triggers run the proxy contract without creating a phone session', () => {
  const source = readFileSync(new URL('../.github/workflows/web-integration-smoke.yml', import.meta.url), 'utf8');
  assert.equal(source.split('"tests/review-receipt-loss-proxy.test.mjs"').length - 1, 2);
  const step = parse(source).jobs.smoke.steps.find(row => row.name === 'Test immutable rating retries after connection loss');
  assert(step.run.includes('tests/review-receipt-loss-proxy.test.mjs')); assert(!step.run.includes('manual-review-receipt-loss-session.mjs'));
});

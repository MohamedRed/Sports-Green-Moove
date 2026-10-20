import test from 'node:test';
import assert from 'node:assert/strict';
import { openSessionRestorationFaultProxy } from '../scripts/qa/session-restoration-fault-proxy.mjs';

const config = { origin: 'http://127.0.0.1:5001/demo-sgm-local-qa/us-central1', runId: 'a'.repeat(32), uid: 'sgm-qa-parent' };
async function fixture(t, overrides = {}) {
  const forwarded = [];
  const proxy = await openSessionRestorationFaultProxy(config, {
    verifyIdentity: async token => { assert.equal(token, 'synthetic-qa-token'); return { uid: config.uid }; },
    forward: async (url, options) => {
      forwarded.push({ url, options });
      return Response.json({ result: url.endsWith('initializeUserProfile') ? { userId: config.uid } : { ride: null } });
    }, ...overrides,
  });
  t.after(() => proxy.close());
  const post = async (path, data = { data: {} }, token = 'synthetic-qa-token') => {
    const response = await fetch(`http://127.0.0.1:${proxy.port}${path}`, { method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token }, body: JSON.stringify(data) });
    return { status: response.status, body: await response.json() };
  };
  return { proxy, forwarded, post, initialize: () => post('/demo-sgm-local-qa/us-central1/initializeUserProfile') };
}
test('two explicit failures precede one-way recovery without forwarding or retaining credentials', async t => {
  const f = await fixture(t);
  for (let i = 1; i <= 2; i++) {
    assert.equal((await f.initialize()).status, 503);
    assert.deepEqual((await f.post('/__qa/state', { runId: config.runId })).body,
      { phase: 'reject', restorationAttempts: i });
    assert.equal(f.forwarded.length, 0);
  }
  assert.equal((await f.post('/__qa/recover', { runId: config.runId })).status, 200);
  assert.equal((await f.initialize()).status, 200);
  assert.equal((await f.post('/demo-sgm-local-qa/us-central1/getActiveRide')).status, 200);
  assert.equal(f.forwarded.length, 2);
  assert(f.forwarded.every(item => item.url.startsWith(config.origin + '/')));
  assert(f.forwarded.every(item => item.options.redirect === 'error'));
  assert.equal(f.proxy.receipt.failed, undefined);
  assert.doesNotMatch(JSON.stringify(f.proxy.receipt), /synthetic-qa-token|authorization|private-qa-session-error-detail/);
});
test('the proxy cannot target production or another fixture identity', async () => {
  for (const invalid of [{ ...config, origin: 'https://production.invalid' }, { ...config, uid: 'real-user' },
    { ...config, runId: 'bad' }]) await assert.rejects(openSessionRestorationFaultProxy(invalid, { verifyIdentity: async () => ({ uid: config.uid }) }));
});
test('an automatic third restoration attempt is a failed trial, never a hidden recovery', async t => {
  const f = await fixture(t); await f.initialize(); await f.initialize();
  assert.equal((await f.initialize()).status, 502); assert.equal(f.proxy.receipt.failed, true);
  assert.equal(f.forwarded.length, 0);
});
test('premature recovery cannot be accepted', async t => {
  const f = await fixture(t);
  assert.equal((await f.post('/__qa/recover', { runId: config.runId })).status, 502);
  assert.equal(f.proxy.receipt.phase, 'reject'); assert.equal(f.proxy.receipt.failed, true);
});
test('a second recovery transition cannot be accepted', async t => {
  const f = await fixture(t); await f.initialize(); await f.initialize();
  assert.equal((await f.post('/__qa/recover', { runId: config.runId })).status, 200);
  assert.equal((await f.post('/__qa/recover', { runId: config.runId })).status, 502);
  assert.equal(f.proxy.receipt.failed, true);
  assert.deepEqual(f.proxy.receipt.transitions, [{ from: 'reject', to: 'recover' }]);
});
test('the selected parent cannot be replaced by a different authenticated user', async t => {
  const f = await fixture(t, { verifyIdentity: async () => ({ uid: 'sgm-qa-driver' }) });
  assert.equal((await f.initialize()).status, 502); assert.equal(f.proxy.receipt.failed, true);
  assert.equal(f.forwarded.length, 0);
});
test('unknown methods, non-empty profile writes and incorrect control run IDs fail closed', async t => {
  const f = await fixture(t);
  for (const [path, data] of [
    ['/demo-sgm-local-qa/us-central1/setUserRoles', { data: {} }],
    ['/demo-sgm-local-qa/us-central1/initializeUserProfile', { data: { displayName: 'not allowed' } }],
    ['/__qa/state', { runId: 'b'.repeat(32) }],
    ['/demo-sgm-local-qa/us-central1/getActiveRide', { data: {} }],
  ]) assert.equal((await f.post(path, data)).status, 502);
  assert.equal(f.forwarded.length, 0); assert.equal(f.proxy.receipt.failed, true);
});

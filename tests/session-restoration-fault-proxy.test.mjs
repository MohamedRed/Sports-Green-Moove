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
      return Response.json({ result: url.endsWith('initializeUserProfile') ? { userId: config.uid } :
        url.endsWith('getProfileCity') ? { userId: config.uid, city: null, revision: 0 } :
          url.endsWith('getActiveRide') ? { ride: null } : { userId: config.uid } });
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
test('complete ledger summaries are allowed only for the restored parent', async t => {
  const f = await fixture(t); await f.initialize(); await f.initialize();
  await f.post('/__qa/recover', { runId: config.runId });
  for (const method of ['getImpactSummary', 'getRewardSummary']) {
    assert.equal((await f.post('/demo-sgm-local-qa/us-central1/' + method)).status, 200);
    assert.equal(f.proxy.receipt.attempts.at(-1).uid, config.uid);
  }
  assert.equal(f.proxy.receipt.failed, undefined);
  const foreign = await fixture(t, { forward: async () => Response.json({result: {userId: 'sgm-qa-driver'}}) });
  await foreign.initialize(); await foreign.initialize(); await foreign.post('/__qa/recover', {runId: config.runId});
  assert.equal((await foreign.post('/demo-sgm-local-qa/us-central1/getRewardSummary')).status, 502);
  assert.equal(foreign.proxy.receipt.failed, true);
});
test('the recovered parent can read its profile city without allowing a profile write', async t => {
  const f = await fixture(t); await f.initialize(); await f.initialize();
  await f.post('/__qa/recover', { runId: config.runId });
  assert.equal((await f.post('/demo-sgm-local-qa/us-central1/getProfileCity')).status, 200);
  assert.equal(f.proxy.receipt.failed, undefined);
  assert.equal(f.forwarded.length, 1);
  assert.equal(f.forwarded[0].url, config.origin + '/getProfileCity');
  assert.equal(f.proxy.receipt.attempts.at(-1).uid, config.uid);
  assert.equal((await f.post('/demo-sgm-local-qa/us-central1/saveProfileCity')).status, 502);
  assert.equal(f.forwarded.length, 1);
});
test('a profile city read cannot run before restoration or use another account', async t => {
  const early = await fixture(t);
  assert.equal((await early.post('/demo-sgm-local-qa/us-central1/getProfileCity')).status, 502);
  assert.equal(early.proxy.receipt.failed, true); assert.equal(early.forwarded.length, 0);
  const foreign = await fixture(t, { verifyIdentity: async () => ({ uid: 'sgm-qa-driver' }) });
  assert.equal((await foreign.post('/demo-sgm-local-qa/us-central1/getProfileCity')).status, 502);
  assert.equal(foreign.proxy.receipt.failed, true); assert.equal(foreign.forwarded.length, 0);
});
test('a recovered city read rejects write-shaped payloads and foreign upstream owners', async t => {
  const payload = await fixture(t); await payload.initialize(); await payload.initialize();
  await payload.post('/__qa/recover', { runId: config.runId });
  assert.equal((await payload.post('/demo-sgm-local-qa/us-central1/getProfileCity',
    { data: { userId: 'sgm-qa-driver' } })).status, 502);
  assert.equal(payload.forwarded.length, 0); assert.equal(payload.proxy.receipt.failed, true);
  const owner = await fixture(t, { forward: async () => Response.json({ result: { userId: 'sgm-qa-driver' } }) });
  await owner.initialize(); await owner.initialize(); await owner.post('/__qa/recover', { runId: config.runId });
  assert.equal((await owner.post('/demo-sgm-local-qa/us-central1/getProfileCity')).status, 502);
  assert.equal(owner.proxy.receipt.failed, true);
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

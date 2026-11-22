import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = readFileSync(new URL('../admin/src/MembershipReviewController.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const { MembershipReviewController } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
const item = () => ({ id: 'request', name: 'Camille QA', userId: 'applicant', role: 'member', status: 'requested',
  active: false, requestVersion: '1800000000.1', allowedActions: ['approve', 'reject'], reviewedByUserId: null });
const page = (items, nextCursor = null) => ({ items, nextCursor });
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
async function ready(overrides = {}) {
  const pending = item();
  const gateway = { clubs: async () => page([{ id: 'club', name: 'Club QA' }]), members: async () => page([pending]), decide: async () => {}, ...overrides };
  const state = new MembershipReviewController(gateway);
  await state.loadClubs(); await state.select('club');
  return { state, gateway, pending };
}
test('membership loading is distinct from completed empty history', async () => {
  const gate = deferred();
  const { state } = await ready();
  state.close();
  const pending = new MembershipReviewController({ clubs: async () => page([{ id: 'club', name: 'Club' }]), members: () => gate.promise });
  await pending.loadClubs();
  const loading = pending.select('club');
  assert.equal(pending.snapshot().loaded, false); assert.equal(pending.snapshot().busy, true);
  gate.resolve(page([])); await loading;
  assert.equal(pending.snapshot().loaded, true); assert.deepEqual(pending.snapshot().items, []);
});
test('concurrent confirmations produce only one gateway write', async () => {
  const gate = deferred(); let writes = 0;
  const { state, pending } = await ready({ decide: async () => { writes++; await gate.promise; } });
  const first = state.decide(pending, 'approve');
  await state.decide(pending, 'reject'); assert.equal(writes, 1);
  gate.resolve(); await first; assert.equal(state.snapshot().notice, 'Adhésion acceptée.');
});
test('an uncertain decision requires explicit reload before another write', async () => {
  let writes = 0;
  const { state, pending } = await ready({ decide: async () => { writes++; throw new Error('lost acknowledgement'); } });
  await state.decide(pending, 'approve');
  assert.equal(state.snapshot().requiresReload, true);
  await state.decide(pending, 'approve'); assert.equal(writes, 1);
  await state.reload(); assert.equal(state.snapshot().requiresReload, false);
});
test('an acknowledged decision is not reported as unsent when the refresh fails', async () => {
  let reads = 0;
  const { state, pending } = await ready({ members: async () => { if (++reads > 1) throw new Error('offline'); return page([pendingItem]); } });
  await state.decide(state.snapshot().items[0], 'reject');
  assert.match(state.snapshot().error, /Décision enregistrée/);
  assert.equal(state.snapshot().notice, 'Adhésion refusée.'); assert.equal(state.snapshot().requiresReload, true);
});
const pendingItem = item();
test('stale rows and missing capabilities cannot dispatch a decision', async () => {
  let writes = 0;
  const { state, pending } = await ready({ decide: async () => { writes++; } });
  await state.decide({ ...pending }, 'approve');
  await state.decide(pending, 'elevate');
  assert.equal(writes, 0);
});
test('closed account state cannot receive a late response', async () => {
  const gate = deferred();
  const state = new MembershipReviewController({ clubs: () => gate.promise });
  const loading = state.loadClubs(); state.close();
  gate.resolve(page([{ id: 'foreign', name: 'Late club' }])); await loading;
  assert.deepEqual(state.snapshot().clubs, []); assert.equal(state.snapshot().busy, false);
});
test('strict effect cleanup and restart ignore the preceding request', async () => {
  const first = deferred(); let calls = 0;
  const state = new MembershipReviewController({ clubs: async () => ++calls === 1 ? first.promise : page([{ id: 'new', name: 'Current' }]) });
  state.start(); state.close(); state.start();
  await new Promise((resolve) => setImmediate(resolve));
  first.resolve(page([{ id: 'old', name: 'Old' }])); await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(state.snapshot().clubs.map((club) => club.id), ['new']);
});
test('pagination refuses a non-advancing cursor and disables further decisions', async () => {
  const { state } = await ready({ members: async () => page([item()], 'same-page') });
  await state.reload(true);
  assert.equal(state.snapshot().requiresReload, true); assert.match(state.snapshot().error, /Actualisez/);
});
test('a filtered empty club page retains the cursor to a later authorized club', async () => {
  const state = new MembershipReviewController({ clubs: async (cursor) => cursor
    ? page([{ id: 'club', name: 'Authorized club' }]) : page([], 'next-clubs') });
  await state.loadClubs(); assert.equal(state.snapshot().nextClubs, 'next-clubs');
  await state.loadClubs(true); assert.equal(state.snapshot().clubs[0].id, 'club');
  assert.equal(state.snapshot().nextClubs, null);
  const panel = readFileSync(new URL('../admin/src/MembershipReviewPanel.tsx', import.meta.url), 'utf8');
  assert.match(panel, /!state.nextClubs && state.clubs.length === 0/);
});

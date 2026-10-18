import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = (file) => readFileSync(new URL('../admin/src/' + file, import.meta.url), 'utf8');
const compile = (value) => ts.transpileModule(value, { compilerOptions: {
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext,
} }).outputText;
const url = (value) => `data:text/javascript;base64,${Buffer.from(value).toString('base64')}`;
const labels = url(compile(source('guardianReviewTypes.ts')));
const { GuardianReviewController } = await import(url(compile(source('GuardianReviewController.ts')).replace('"./guardianReviewTypes"', JSON.stringify(labels))));
const { guardianReview, guardianPage, guardianClub, guardianStatus } = await import(url(compile(source('guardianReviewWire.ts'))));
const item = () => ({ id: 'a'.repeat(64), clubId: 'club', clubName: 'Club QA', childId: 'child', childName: 'Enfant QA',
  parentUserId: 'parent', parentName: 'Parent QA', status: 'requested', revision: 1, allowedActions: ['verify', 'refuse'] });
const page = (items, nextCursor = null) => ({ items, nextCursor });
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
async function ready(overrides = {}) {
  const pending = item();
  const gateway = { clubs: async () => page([{ id: 'club', name: 'Club QA' }]), requests: async () => page([pending]),
    decide: async () => 'verified', ...overrides };
  const controller = new GuardianReviewController(gateway, () => 'a13013ac-758d-4e44-a15b-76701d126ec6');
  await controller.loadClubs(); await controller.select('club');
  return { controller, gateway, pending };
}

test('guardian decision sends only the displayed tuple, revision, action and operation identity', async () => {
  const writes = [];
  const { controller, pending } = await ready({ decide: async (row, operation) => { writes.push({ row, operation }); return 'verified'; } });
  await controller.decide(pending, 'verify');
  assert.equal(writes.length, 1); assert.equal(writes[0].row, pending);
  assert.deepEqual(writes[0].operation, { clubId: 'club', childId: 'child', parentUserId: 'parent', action: 'verify',
    expectedRevision: 1, requestId: 'a13013ac-758d-4e44-a15b-76701d126ec6' });
  assert.equal(controller.snapshot().notice, 'État actuel : Parent vérifié.');
});
test('a returned current revoked state is never reported as a new verification', async () => {
  const { controller, pending } = await ready({ decide: async () => 'revoked' });
  await controller.decide(pending, 'verify');
  assert.equal(controller.snapshot().notice, 'État actuel : Vérification retirée.');
});
test('double confirmations cannot dispatch two decisions', async () => {
  const gate = deferred(); let writes = 0;
  const { controller, pending } = await ready({ decide: async () => { writes++; return gate.promise; } });
  const first = controller.decide(pending, 'verify'); await controller.decide(pending, 'refuse');
  assert.equal(writes, 1); gate.resolve('verified'); await first;
});
test('unknown decision outcomes clear stale requests and require an explicit reload', async () => {
  let writes = 0;
  const { controller, pending } = await ready({ decide: async () => { writes++; throw new Error('lost reply'); } });
  await controller.decide(pending, 'verify');
  assert.equal(controller.snapshot().requiresReload, true); assert.deepEqual(controller.snapshot().items, []);
  assert.match(controller.snapshot().error, /non confirmée/);
  await controller.decide(pending, 'verify'); assert.equal(writes, 1);
  await controller.reload(); assert.equal(controller.snapshot().requiresReload, false);
});
test('confirmed decision plus failed refresh is distinguished from unconfirmed submission', async () => {
  let reads = 0;
  const { controller, pending } = await ready({ requests: async () => { if (++reads > 1) throw new Error('offline'); return page([pendingItem]); } });
  await controller.decide(pending, 'verify');
  // The gateway's loaded object, not a lookalike, is the only actionable request.
  await controller.decide(controller.snapshot().items[0], 'verify');
  assert.match(controller.snapshot().error, /Décision enregistrée/);
  assert.equal(controller.snapshot().notice, 'État actuel : Parent vérifié.');
  assert.deepEqual(controller.snapshot().items, []);
});
const pendingItem = item();
test('stale, foreign, missing-identity and unavailable actions cannot be sent', async () => {
  let writes = 0;
  const { controller, pending } = await ready({ decide: async () => { writes++; return 'verified'; } });
  await controller.decide({ ...pending }, 'verify'); await controller.decide(pending, 'revoke');
  pending.clubId = 'foreign'; await controller.decide(pending, 'verify'); pending.clubId = 'club';
  pending.childName = null; await controller.decide(pending, 'verify'); assert.equal(writes, 0);
});
test('failed pagination clears private records and blocks further decisions', async () => {
  const { controller } = await ready({ requests: async () => page([item()], 'same-cursor') });
  await controller.reload(true);
  assert.equal(controller.snapshot().requiresReload, true); assert.deepEqual(controller.snapshot().items, []);
});
test('closed sessions and strict-effect restarts cannot receive late account results', async () => {
  const first = deferred(); let calls = 0;
  const controller = new GuardianReviewController({ clubs: async () => ++calls === 1 ? first.promise : page([{ id: 'new', name: 'Current' }]) });
  controller.start(); controller.close(); controller.start();
  await new Promise((resolve) => setImmediate(resolve));
  first.resolve(page([{ id: 'old', name: 'Old' }])); await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(controller.snapshot().clubs.map((club) => club.id), ['new']);
});
test('filtered empty club pages are not confused with exhausted management access', async () => {
  const controller = new GuardianReviewController({ clubs: async (cursor) => cursor
    ? page([{ id: 'club', name: 'Club QA' }]) : page([], 'next-page') });
  await controller.loadClubs(); assert.equal(controller.snapshot().nextClubs, 'next-page');
  await controller.loadClubs(true); assert.equal(controller.snapshot().clubs[0].id, 'club');
});
test('manager wire decoder rejects foreign clubs, malformed revisions and capabilities', () => {
  assert.deepEqual(guardianReview(item(), 'club', 'manager'), item());
  for (const patch of [{ clubId: 'foreign' }, { id: 'wrong' }, { revision: '1' }, { revision: 0 },
    { allowedActions: ['revoke'] }, { allowedActions: ['verify', 'verify'] }, { status: 'legacy-verified' },
    { parentUserId: 'manager' }, { childName: '' }, { parentName: undefined }])
    assert.throws(() => guardianReview({ ...item(), ...patch }, 'club', 'manager'));
  assert.throws(() => guardianStatus({ toString: () => 'verified' }));
});
test('wire pages require a bounded actual page and explicit cursor state', () => {
  assert.deepEqual(guardianPage(page([{ id: 'club', name: 'Club QA' }]), guardianClub), page([{ id: 'club', name: 'Club QA' }]));
  for (const value of [{ items: [] }, { items: [], nextCursor: '' }, { items: {}, nextCursor: null },
    { items: Array(21).fill({ id: 'club', name: 'Club' }), nextCursor: null }]) assert.throws(() => guardianPage(value, guardianClub));
});

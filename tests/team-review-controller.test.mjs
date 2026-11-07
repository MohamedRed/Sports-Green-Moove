import test from 'node:test';
import assert from 'node:assert/strict';
import { TeamReviewController, team, item, page, requests, ready, operationId, deferred } from './team-review-support.mjs';

test('manager selects an explicit club then team before reading or deciding an enrollment', async () => {
  const calls = [];
  const controller = new TeamReviewController({ clubs: async () => page([{ id: 'club', name: 'Club' }]),
    teams: async (club) => { calls.push(club); return page([team()]); }, requests: async (selected) => {
      calls.push(selected.id); return requests([item()]); } });
  await controller.loadClubs(); assert.deepEqual(calls, []);
  await controller.selectClub('foreign'); assert.deepEqual(calls, []);
  await controller.selectClub('club'); assert.deepEqual(calls, ['club']);
  await controller.selectTeam('foreign'); assert.deepEqual(calls, ['club']);
  await controller.selectTeam('team'); assert.deepEqual(calls, ['club', 'team']);
  assert.equal(controller.snapshot().teamName, 'Équipe QA');
});
test('confirmation sends exactly the displayed identity, action, revision and a fresh operation id', async () => {
  const writes = [];
  const { controller, pending } = await ready({ decide: async (row, operation) => { writes.push({ row, operation }); return 'approved'; } });
  await controller.decide(pending, 'approve'); assert.equal(writes.length, 1); assert.equal(writes[0].row, pending);
  assert.deepEqual(writes[0].operation, { enrollmentId: pending.id, action: 'approve', expectedRevision: 1, requestId: operationId });
  assert.equal(controller.snapshot().notice, 'État actuel : Inscription approuvée.');
  assert.equal(controller.snapshot().requiresReload, false);
});
test('returned current revoked state is not presented as a new approval', async () => {
  const { controller, pending } = await ready({ decide: async () => 'revoked' });
  await controller.decide(pending, 'approve'); assert.equal(controller.snapshot().notice, 'État actuel : Inscription retirée.');
});
test('double confirmations do not dispatch twice while the first outcome is unknown', async () => {
  const gate = deferred(); let writes = 0;
  const { controller, pending } = await ready({ decide: async () => { writes++; return gate.promise; } });
  const first = controller.decide(pending, 'approve'); await controller.decide(pending, 'refuse');
  assert.equal(writes, 1); gate.resolve('approved'); await first;
});
test('lost reply clears stale actions and requires a deliberate read before another decision', async () => {
  let writes = 0;
  const { controller, pending } = await ready({ decide: async () => { writes++; throw new Error('lost reply'); } });
  await controller.decide(pending, 'approve'); assert.equal(controller.snapshot().requiresReload, true);
  assert.deepEqual(controller.snapshot().items, []); assert.match(controller.snapshot().error, /non confirmée/);
  await controller.decide(pending, 'approve'); assert.equal(writes, 1);
  await controller.reload(); assert.equal(controller.snapshot().requiresReload, false);
});
test('a confirmed decision followed by an unavailable list remains confirmed, with no stale records', async () => {
  let reads = 0; const pending = item();
  const { controller } = await ready({ requests: async () => { if (++reads > 1) throw Error('offline'); return requests([pending]); } });
  await controller.decide(pending, 'approve');
  assert.match(controller.snapshot().error, /Décision enregistrée/);
  assert.equal(controller.snapshot().notice, 'État actuel : Inscription approuvée.');
  assert.deepEqual(controller.snapshot().items, []); assert.equal(controller.snapshot().requiresReload, true);
});
test('lookalike, foreign, unsafe-revision, nameless and unavailable actions never dispatch', async () => {
  let writes = 0;
  const { controller, pending, selected } = await ready({ decide: async () => { writes++; return 'approved'; } });
  await controller.decide({ ...pending }, 'approve'); await controller.decide(pending, 'revoke');
  for (const [key, value] of [['clubId', 'foreign'], ['teamId', 'foreign'], ['teamInstanceId', 'c'.repeat(64)],
    ['revision', Number.MAX_SAFE_INTEGER], ['subjectName', null]]) {
    const previous = pending[key]; pending[key] = value; await controller.decide(pending, 'approve'); pending[key] = previous;
  }
  selected.open = false; await controller.decide(pending, 'approve'); assert.equal(writes, 0);
  await controller.decide(pending, 'refuse'); assert.equal(writes, 1);
});
test('a missing current team label prevents approval even when the old option was named', async () => {
  let writes = 0; const pending = item();
  const { controller } = await ready({ requests: async () => ({ ...requests([pending]), teamName: null }),
    decide: async () => { writes++; return 'approved'; } });
  await controller.decide(pending, 'approve'); assert.equal(writes, 0);
});
test('changing clubs immediately clears selected team and private enrollment rows', async () => {
  const gate = deferred();
  const { controller, gateway } = await ready({ clubs: async () => page([{ id: 'club', name: 'Club' }, { id: 'other', name: 'Autre' }]) });
  gateway.teams = async () => gate.promise;
  const next = controller.selectClub('other');
  assert.equal(controller.snapshot().teamId, ''); assert.deepEqual(controller.snapshot().items, []);
  assert.equal(controller.snapshot().busy, true); gate.resolve(page([])); await next;
});
test('closed sessions and strict-effect restarts discard late account results', async () => {
  const gate = deferred(); let calls = 0;
  const controller = new TeamReviewController({ clubs: async () => ++calls === 1 ? gate.promise : page([{ id: 'new', name: 'Nouveau' }]) });
  controller.start(); controller.close(); controller.start(); await new Promise(setImmediate);
  gate.resolve(page([{ id: 'old', name: 'Ancien' }])); await new Promise(setImmediate);
  assert.deepEqual(controller.snapshot().clubs.map((row) => row.id), ['new']);
});
test('filtered empty team pages preserve the next page instead of claiming there are no teams', async () => {
  const { controller, gateway } = await ready();
  gateway.teams = async (_club, cursor) => cursor ? page([team()]) : page([], 'next');
  await controller.loadTeams(); assert.equal(controller.snapshot().nextTeams, 'next');
  await controller.loadTeams(true); assert.equal(controller.snapshot().teams.length, 1);
});
test('enrollment pagination retains every distinct record and detects cursor cycles', async () => {
  const { controller, gateway } = await ready();
  gateway.requests = async (_team, cursor) => requests([{ ...item(), id: cursor ?? 'first' }], cursor === 'second' ? 'next' : cursor ? 'second' : 'next');
  await controller.reload(); await controller.reload(true); assert.equal(controller.snapshot().items.length, 2);
  await controller.reload(true); assert.equal(controller.snapshot().requiresReload, true);
  assert.deepEqual(controller.snapshot().items, []);
});
test('duplicate pages and revoked team-list access remove private records and choices', async () => {
  const { controller, gateway } = await ready();
  gateway.requests = async () => requests([item()], 'next'); await controller.reload(); await controller.reload(true);
  assert.equal(controller.snapshot().requiresReload, true); assert.deepEqual(controller.snapshot().items, []);
  gateway.teams = async () => { throw Error('permission denied'); }; await controller.loadTeams();
  assert.deepEqual(controller.snapshot().teams, []); assert.equal(controller.snapshot().teamId, '');
});
test('an explicit permission or authentication denial immediately clears saved team identities as well as rows', async () => {
  for (const code of ['functions/permission-denied', 'functions/unauthenticated']) {
    const { controller, gateway } = await ready();
    gateway.requests = async () => { throw Object.assign(new Error('denied'), { code }); };
    await controller.reload();
    assert.deepEqual(controller.snapshot().items, []); assert.deepEqual(controller.snapshot().teams, []);
    assert.equal(controller.snapshot().teamId, ''); assert.equal(controller.snapshot().teamName, null);
  }
});

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { Timestamp } from 'firebase-admin/firestore';
import { auth, db, call, denied, signIn } from './local-flow-client.mjs';
import { withLocalAdminCleanup } from './local-admin-lifecycle.mjs';
import { seedLedgerHistory } from './ledger-history-fixtures.mjs';

const root = resolve(import.meta.dirname, '../..'), checks = [], legacy = {}, summaries = {};
const uid = 'sgm-qa-ledger-owner', foreignUid = 'sgm-qa-ledger-foreign';
const check = async (id, action) => { await action(); checks.push({ id, status: 'passed' }); };
const sourcePaths = ['android/app/src/main/java/be/sportgreenmoove/app/services/FirebaseAndroidLedgerGateway.kt',
  'ios/Sources/SportsGreenMooveApp/FirebaseImpactRewards.swift', 'scripts/qa/ledger-history-services-suite.mjs',
  'functions/src/domain/ledgerSummaries.ts', 'functions/src/services/ledgerSummaries.ts', 'functions/src/callables/ledgerSummaries.ts',
  'scripts/qa/ledger-history-fixtures.mjs'];
const sourceFiles = Object.fromEntries(sourcePaths.map(path => [path,
  createHash('sha256').update(readFileSync(resolve(root, path))).digest('hex')]));
await withLocalAdminCleanup(async () => {
  for (const [id, email] of [[uid, 'ledger@example.test'], [foreignUid, 'ledger-foreign@example.test'],
    ['sgm-qa-ledger-empty', 'ledger-empty@example.test']])
    await auth.createUser({ uid: id, email, password: process.env.SGM_QA_PASSWORD });
  await seedLedgerHistory(db, uid, foreignUid);
  await check('reproduced-truncated-reward-query', async () => {
    const query = db.collection('rewardLedger').where('userId', '==', uid);
    const limited = (await query.limit(100).get()).docs, complete = (await query.get()).docs;
    const sum = docs => docs.reduce((total, doc) => total + doc.get('amountCents'), 0);
    assert.equal(limited.length, 100); assert.equal(complete.length, 257);
    assert.equal(sum(limited), 10_000); assert.equal(sum(complete), -22_000);
    legacy.rewards = { limitedCount: 100, completeCount: 257, limitedBalanceCents: sum(limited), completeBalanceCents: sum(complete) };
  });
  await check('reproduced-truncated-impact-query', async () => {
    const query = db.collection('co2Ledger').where('userId', '==', uid);
    const limited = (await query.limit(100).get()).docs, complete = (await query.get()).docs;
    const sum = docs => docs.reduce((total, doc) => total + doc.get('co2SavedKg'), 0);
    assert.equal(limited.length, 100); assert.equal(complete.length, 257);
    assert.equal(sum(limited), 125); assert.equal(sum(complete), 321.25);
    legacy.impact = { limitedCount: 100, completeCount: 257, limitedCo2Kg: sum(limited), completeCo2Kg: sum(complete) };
  });
  const actor = await signIn('ledger@example.test'), foreign = await signIn('ledger-foreign@example.test');
  const empty = await signIn('ledger-empty@example.test');
  const snapshot = async () => ({
    ledgers: Object.fromEntries(await Promise.all(['rewardLedger', 'co2Ledger'].map(async name => [name,
      (await db.collection(name).orderBy('__name__').get()).docs.map(row => ({ id: row.id, data: row.data() }))]))),
    claims: await Promise.all([actor, foreign, empty].map(async account => (await auth.getUser(account.uid)).customClaims ?? {})),
  });
  const baseline = await snapshot();
  await check('authenticated-owner-only-summary-contract', async () => {
    for (const name of ['getImpactSummary', 'getRewardSummary']) {
      await denied(name, null, {}, 'UNAUTHENTICATED');
      for (const data of [{userId: foreignUid}, {uid: foreignUid}, {limit: 100}, {cursor: 'ledger-100'}])
        await denied(name, actor, data, 'INVALID_ARGUMENT');
    }
  });
  await check('complete-posted-balance-and-latest-eight-mixed-timestamps', async () => {
    const result = await call('getRewardSummary', actor);
    assert.equal(result.userId, uid); assert.equal(result.balanceCents, -22_000); assert.equal(result.entries.length, 8);
    const expected = baseline.ledgers.rewardLedger.filter(row => row.data.userId === uid).map(({id, data}) => ({
      id, type: data.type, amountCents: data.amountCents,
      createdAtMillis: typeof data.createdAt === 'string' ? Date.parse(data.createdAt) : data.createdAt.toMillis(),
    })).sort((a, b) => b.createdAtMillis - a.createdAtMillis || (a.id < b.id ? -1 : 1)).slice(0, 8);
    assert.deepEqual(result.entries, expected); assert(result.entries.some(row => Number(row.id.slice(-3)) > 100));
    summaries.rewards = result;
  });
  await check('all-impact-pages-with-six-occupied-months', async () => {
    const result = await call('getImpactSummary', actor);
    assert.deepEqual({userId: result.userId, totalCo2Kg: result.totalCo2Kg, sharedDistanceKm: result.sharedDistanceKm, rideCount: result.rideCount},
      {userId: uid, totalCo2Kg: 321.25, sharedDistanceKm: 257, rideCount: 257});
    assert.deepEqual(result.months.map(row => row.month), ['2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07']);
    for (const row of result.months) {
      const month = Number(row.month.slice(-2)) - 1;
      assert.equal(row.co2SavedKg, Array.from({length: 257}, (_, i) => i + 1).filter(index => index % 7 === month).length * 1.25);
    }
    summaries.impact = result;
  });
  await check('foreign-account-and-empty-ledger-isolation', async () => {
    assert.equal((await call('getRewardSummary', foreign)).balanceCents, 999_999);
    assert.equal((await call('getImpactSummary', foreign)).totalCo2Kg, 999);
    assert.deepEqual(await call('getRewardSummary', empty), {userId: empty.uid, balanceCents: 0, entries: []});
    assert.deepEqual(await call('getImpactSummary', empty), {userId: empty.uid, totalCo2Kg: 0, sharedDistanceKm: 0, rideCount: 0, months: []});
  });
  await check('malformed-financial-and-impact-records-fail-closed', async () => {
    for (const [collection, name, data] of [
      ['rewardLedger', 'getRewardSummary', {userId: uid, amountCents: 0.5, currency: 'eur', type: 'payout', createdAt: Timestamp.now()}],
      ['co2Ledger', 'getImpactSummary', {userId: uid, co2SavedKg: 3, createdAt: Timestamp.now()}],
    ]) {
      const ref = db.collection(collection).doc('malformed-owned-qa'); await ref.create(data);
      try { await denied(name, actor, {}, 'FAILED_PRECONDITION'); }
      finally { await ref.delete(); }
    }
  });
  await check('summaries-never-change-ledgers-or-account-authority', async () => {
    assert.deepEqual(await snapshot(), baseline);
  });
}, { firestore: db });
const output = { scope: 'isolated-ledger-summary-services-not-native-ui-or-production',
  testedAt: new Date().toISOString(), projectId: 'demo-sgm-local-qa', runId: process.env.SGM_LOCAL_RUN_ID,
  checks, legacy, summaries, adminClientClosed: true, firestoreClientTerminated: true, sourceFiles,
  productionWrites: false, realPayments: false, nativeUiExecuted: false, releaseComplete: false };
mkdirSync(dirname(process.env.SGM_LOCAL_FLOW_OUTPUT), { recursive: true });
writeFileSync(process.env.SGM_LOCAL_FLOW_OUTPUT, JSON.stringify(output, null, 2) + '\n', { flag: 'wx' });
console.log('Isolated ledger query reproduction complete. No native or payment acceptance.');

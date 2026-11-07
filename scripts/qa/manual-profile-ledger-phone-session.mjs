import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { profileLedgerPhonePhases, verifyProfileLedgerPhoneState } from './profile-ledger-phone-checkpoints.mjs';

const [sessionPath, output] = process.argv.slice(2);
assert(isAbsolute(sessionPath ?? '') && isAbsolute(output ?? '') && process.stdin.isTTY);
assert.equal(statSync(sessionPath).mode & 0o077, 0);
const session = JSON.parse(readFileSync(sessionPath)); assert.equal(session.projectId, 'demo-sgm-local-qa');
assert.match(session.runId, /^[a-f0-9]{32}$/); process.env.SGM_QA_PASSWORD = session.password;
const {auth, db, call, signIn} = await import('./local-flow-client.mjs');
const {seedLedgerHistory} = await import('./ledger-history-fixtures.mjs');
const {withLocalAdminCleanup} = await import('./local-admin-lifecycle.mjs');
const {deleteApp} = await import('firebase-admin/app');
mkdirSync(output, {mode: 0o700});
const input = createInterface({input: process.stdin, terminal: false}), checkpoints = [];
const stop = () => input.close(); process.once('SIGINT', stop); process.once('SIGTERM', stop);
let completed = false, failure, baseline, previous, fixture, adminClientClosed = false, firestoreClientTerminated = false;
try {
  await withLocalAdminCleanup(async () => {
    const actors = {parent: await signIn(session.parent), driver: await signIn(session.driver)};
    for (const actor of Object.values(actors)) await call('initializeUserProfile', actor);
    await seedLedgerHistory(db, actors.parent.uid, actors.driver.uid);
    await call('saveProfileCity', actors.driver, {city: 'Namur', expectedRevision: 0, requestId: randomUUID()});
    const records = async () => {
      const names = (await db.listCollections()).map(row => row.id).sort();
      const documents = Object.fromEntries(await Promise.all(names.map(async name => [name,
        (await db.collection(name).orderBy('__name__').get()).docs.map(doc => {
          const data = doc.data();
          if (name === 'users' && Object.values(actors).some(actor => actor.uid === doc.id)) delete data.updatedAt;
          return {id: doc.id, data};
        })])));
      const accounts = await auth.listUsers(1000); assert(!accounts.pageToken);
      return JSON.parse(JSON.stringify({documents, claims: accounts.users.map(user => ({uid: user.uid,
        claims: user.customClaims ?? {}})).sort((a, b) => a.uid.localeCompare(b.uid))}));
    };
    const snapshot = async () => {
      const before = await records(), cities = {}, ledgers = {};
      for (const [name, actor] of Object.entries(actors)) {
        cities[name] = await call('getProfileCity', actor);
        ledgers[name] = {impact: await call('getImpactSummary', actor), rewards: await call('getRewardSummary', actor)};
      }
      assert.deepEqual(await records(), before, 'Independent reads cannot change the trial');
      return {records: before, cities, ledgers};
    };
    baseline = await snapshot();
    fixture = {parentUid: actors.parent.uid, driverUid: actors.driver.uid,
      parentLedger: baseline.ledgers.parent, driverLedger: baseline.ledgers.driver};
    assert.equal(fixture.parentLedger.rewards.balanceCents, -22_000);
    assert.equal(fixture.parentLedger.impact.rideCount, 258);
    assert(Math.abs(fixture.parentLedger.impact.totalCo2Kg - 324.45) < 1e-8);
    assert.equal(fixture.driverLedger.rewards.balanceCents, 1_000_249);
    writeFileSync(resolve(output, 'baseline.json'), JSON.stringify({projectId: session.projectId, runId: session.runId,
      fixture, baseline}, null, 2) + '\n', {mode: 0o600, flag: 'wx'});
    console.log('Isolated profile and ledger records ready. Observe the phone, then enter: ' + profileLedgerPhonePhases.join(', ') + ', finish.');
    console.log('After fixture setup this observer only reads; only the phone may save or clear the parent city.');
    for await (const command of input) {
      const phase = command.trim(); if (phase === 'stop') break;
      if (phase === 'finish') { assert.equal(checkpoints.length, profileLedgerPhonePhases.length); completed = true; break; }
      assert.equal(phase, profileLedgerPhonePhases[checkpoints.length]);
      const state = await snapshot();
      const result = verifyProfileLedgerPhoneState(phase, baseline, state, fixture, previous);
      writeFileSync(resolve(output, phase + '.json'), JSON.stringify({projectId: session.projectId, runId: session.runId,
        recordedAt: new Date().toISOString(), state, result}, null, 2) + '\n', {mode: 0o600, flag: 'wx'});
      previous = state; checkpoints.push(result); console.log('Independent profile/ledger checkpoint passed: ' + phase);
    }
  }, {firestore: {terminate: async () => {await db.terminate(); firestoreClientTerminated = true;}},
    closeApp: async app => {await deleteApp(app); adminClientClosed = true;}});
} catch (error) {failure = error;}
finally {
  input.close(); process.removeListener('SIGINT', stop); process.removeListener('SIGTERM', stop);
  delete process.env.SGM_QA_PASSWORD;
}
const sources = ['scripts/qa/manual-profile-ledger-phone-session.mjs', 'scripts/qa/profile-ledger-phone-checkpoints.mjs',
  'scripts/qa/ledger-history-fixtures.mjs', 'functions/src/services/profileCity.ts',
  'functions/src/services/ledgerSummaries.ts', 'functions/src/domain/ledgerSummaries.ts'];
writeFileSync(resolve(output, 'session-results.json'), JSON.stringify({projectId: session.projectId, runId: session.runId,
  testedAt: new Date().toISOString(), scope: 'independent-profile-ledger-phone-records-not-ui-proof',
  completed: completed && !failure, checkpoints, fixture, adminClientClosed, firestoreClientTerminated,
  physicalUiProven: false, wholeProcessRestartProven: false, realPaymentProven: false, productionWrites: false,
  protectedRecordCount: baseline ? Object.values(baseline.records.documents).reduce((count, rows) => count + rows.length, 0) : 0,
  sourceFiles: Object.fromEntries(sources.map(file => [file,
    createHash('sha256').update(readFileSync(resolve(import.meta.dirname, '../..', file))).digest('hex')]))}, null, 2) + '\n', {mode: 0o600, flag: 'wx'});
if (failure) throw new Error(String(failure.message).replaceAll(session.password, '[REDACTED]'));
console.log('Profile/ledger observer and actual Admin clients closed; dispose of the phone, helper and owned backend separately.');

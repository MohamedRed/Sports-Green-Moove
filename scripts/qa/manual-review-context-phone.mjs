import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdirSync, readFileSync, statSync, writeFileSync} from 'node:fs';
import {dirname, isAbsolute, resolve} from 'node:path';
import {createInterface} from 'node:readline';
import {contextPhonePhases, verifyContextPhoneState} from './review-context-phone-checkpoints.mjs';

const [sessionPath, output, apk] = process.argv.slice(2);
assert([sessionPath, output, apk].every(path => isAbsolute(path ?? '')) && process.stdin.isTTY);
assert.equal(statSync(sessionPath).mode & 0o077, 0); assert.equal(statSync(dirname(sessionPath)).mode & 0o077, 0);
const session = JSON.parse(readFileSync(sessionPath)); assert.equal(session.projectId, 'demo-sgm-local-qa');
process.env.SGM_QA_PASSWORD = session.password;
const {auth, db, signIn} = await import('./local-flow-client.mjs');
const {collectPendingReviews} = await import('./review-pagination-client.mjs');
const {prepareContextPhoneFixture} = await import('./review-context-phone-fixture.mjs');
const {withLocalAdminCleanup} = await import('./local-admin-lifecycle.mjs');
const {deleteApp} = await import('firebase-admin/app');
mkdirSync(output, {mode: 0o700});
const input = createInterface({input: process.stdin, terminal: false}), checks = [];
const stop = () => input.close(); process.once('SIGINT', stop); process.once('SIGTERM', stop);
let failure, completed = false, adminClientClosed = false, firestoreClientTerminated = false, fixture;
try {
  await withLocalAdminCleanup(async () => {
    const driver = await signIn(session.driver), parent = await signIn(session.parent), originals = new Map();
    for (const collection of await db.listCollections()) for (const row of (await collection.get()).docs) originals.set(row.ref.path, row.data());
    const claims = new Map((await auth.listUsers()).users.map(row => [row.uid, row.customClaims ?? {}]));
    fixture = await prepareContextPhoneFixture(session, driver, parent);
    const originalRatings = new Map((await db.collection('ratings').get()).docs.map(row => [row.id, row.data()]));
    const prepared = new Map();
    for (const collection of ['rideSessions', 'trips']) for (const row of (await db.collection(collection).get()).docs) prepared.set(row.ref.path, row.data());
    console.log('31 contextual completed rides and one explicit legacy case prepared; 31 initial driver ratings are fixture-submitted.');
    console.log('Observe stages: ' + contextPhonePhases.join(', ') + '. finish after signed-out.');
    for await (const command of input) {
      const phase = command.trim(); if (phase === 'stop') break;
      if (phase === 'finish') {assert.equal(checks.length, contextPhonePhases.length); completed = true; break;}
      assert.equal(phase, contextPhonePhases[checks.length]);
      const own = await collectPendingReviews(driver), other = await collectPendingReviews(parent);
      const rows = (await db.collection('ratings').get()).docs.map(row => ({id: row.id, ...row.data()}));
      const check = verifyContextPhoneState(phase, {driver: own.items, parent: other.items, ratings: rows}, fixture);
      assert.equal(other.pages.length, 2); assert.equal(other.pages[0].items.length, 20);
      for (const [id, data] of originalRatings) {const row = rows.find(row => row.id === id); assert(row); const {id: _, ...stored} = row; assert.deepEqual(stored, data);}
      for (const [path, data] of prepared) assert.deepEqual((await db.doc(path).get()).data(), data, path);
      for (const [path, before] of originals) {
        const after = (await db.doc(path).get()).data();
        if ([driver, parent].some(actor => path === 'users/' + actor.uid)) {
          const {updatedAt: oldTime, ...old} = before, {updatedAt: newTime, ...now} = after;
          assert(newTime.toMillis() >= oldTime.toMillis()); assert.deepEqual(now, old, path);
        } else assert.deepEqual(after, before, path);
      }
      for (const [uid, original] of claims) assert.deepEqual((await auth.getUser(uid)).customClaims ?? {}, original);
      const record = {...check, runId: session.runId, observedAt: new Date().toISOString(), parentFirstPageSize: 20,
        originalRecordsAndClaimsPreserved: true, protectedRecordCount: originals.size};
      writeFileSync(resolve(output, phase + '.json'), JSON.stringify(record, null, 2) + '\n', {flag: 'wx', mode: 0o600});
      checks.push(record); console.log('Independent contextual-review checkpoint passed: ' + phase);
    }
  }, {firestore: {terminate: async () => {await db.terminate(); firestoreClientTerminated = true;}},
    closeApp: async app => {await deleteApp(app); adminClientClosed = true;}});
} catch (error) {failure = error;}
finally {input.close(); process.removeListener('SIGINT', stop); process.removeListener('SIGTERM', stop); delete process.env.SGM_QA_PASSWORD;}
const files = ['scripts/qa/manual-review-context-phone.mjs', 'scripts/qa/review-context-phone-fixture.mjs',
  'scripts/qa/review-context-phone-checkpoints.mjs', 'functions/src/services/pendingReviews.ts', 'functions/src/domain/reviewTripContext.ts'];
writeFileSync(resolve(output, 'session-results.json'), JSON.stringify({projectId: session.projectId, runId: session.runId,
  testedAt: new Date().toISOString(), scope: 'independent-contextual-review-record-checkpoints-not-ui-or-release-proof',
  completed: completed && !failure, checks, adminClientClosed, firestoreClientTerminated, productionWrites: false, providerRequests: 0,
  phoneUiProvenByThisObserver: false, fixtureSubmittedInitialRatings: 31, subsequentRatingsFixtureSubmitted: false,
  sourceApkSha256: createHash('sha256').update(readFileSync(apk)).digest('hex'), installedBytesIndependentlyVerified: false,
  sourceFiles: Object.fromEntries(files.map(file => [file, createHash('sha256').update(readFileSync(resolve(import.meta.dirname, '../..', file))).digest('hex')]))}, null, 2) + '\n', {flag: 'wx', mode: 0o600});
if (failure) throw new Error('Contextual review phone observer failed; retain the original observations.');

import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdirSync, readFileSync, statSync, writeFileSync} from 'node:fs';
import {dirname, isAbsolute, resolve} from 'node:path';
import {createInterface} from 'node:readline';
import {reviewPhonePhases, verifyReviewPhoneCheckpoint} from './review-history-phone-checkpoints.mjs';

const [sessionPath, output] = process.argv.slice(2);
assert(isAbsolute(sessionPath ?? '') && isAbsolute(output ?? '') && process.stdin.isTTY);
assert.equal(statSync(sessionPath).mode & 0o077, 0); assert.equal(statSync(dirname(sessionPath)).mode & 0o077, 0);
const session = JSON.parse(readFileSync(sessionPath)); assert.equal(session.projectId, 'demo-sgm-local-qa');
process.env.SGM_QA_PASSWORD = session.password;
const {auth, call, db, signIn} = await import('./local-flow-client.mjs');
const {createReviewHistoryFixture, createCompletedReviewRide} = await import('./review-history-fixture.mjs');
const {collectPendingReviews} = await import('./review-pagination-client.mjs');
const {withLocalAdminCleanup} = await import('./local-admin-lifecycle.mjs');
const {deleteApp} = await import('firebase-admin/app');
mkdirSync(output, {mode: 0o700});
const input = createInterface({input: process.stdin, terminal: false}), checks = [];
const stop = () => input.close(); process.once('SIGINT', stop); process.once('SIGTERM', stop);
let failure, completed = false, published = false, adminClientClosed = false, firestoreClientTerminated = false;
try {
  await withLocalAdminCleanup(async () => {
    const driver = await signIn(session.driver), parent = await signIn(session.parent);
    const protectedRows = new Map();
    for (const collection of await db.listCollections()) for (const row of (await collection.get()).docs) protectedRows.set(row.ref.path, row.data());
    const claims = new Map((await auth.listUsers()).users.map(row => [row.uid, row.customClaims ?? {}]));
    const fixture = await createReviewHistoryFixture(driver, parent);
    const historyRows = new Map((await db.collection('ratings').get()).docs.map(row => [row.id, row.data()]));
    assert.equal(historyRows.size, 104);
    const originalRides = new Map((await db.getAll(...fixture.rides.map(id => db.doc('rideSessions/' + id)))).map(row => [row.id, row.data()]));
    let freshRideOriginal;
    writeFileSync(resolve(output, 'fixture.json'), JSON.stringify({runId: session.runId, fixture,
      scope: 'completed-rides-and-104-ratings-prepared-not-phone-ride-or-rating-proof'}, null, 2) + '\n', {flag: 'wx', mode: 0o600});
    console.log('104 reviews prepared. Observe phone stages and enter: ' + reviewPhonePhases.join(', ') + '.');
    console.log('After history-hidden, publish-new creates one unrated completed fixture. No controller sends either new review.');
    for await (const command of input) {
      const phase = command.trim(); if (phase === 'stop') break;
      if (phase === 'finish') {assert.equal(checks.length, reviewPhonePhases.length); completed = true; break;}
      if (phase === 'publish-new') {
        assert.equal(checks.length, 1); assert.equal(published, false); published = true;
        await createCompletedReviewRide(fixture); freshRideOriginal = (await db.doc('rideSessions/' + fixture.freshRide).get()).data();
        console.log('One new unrated fixture prepared.'); continue;
      }
      assert.equal(phase, reviewPhonePhases[checks.length]);
      if (phase !== 'history-hidden') assert.equal(published, true);
      const ratings = (await db.collection('ratings').get()).docs.map(row => ({id: row.id, ...row.data()}));
      const state = {ratings, driverInbox: {...(await call('getInbox', driver)).inbox, reviews: (await collectPendingReviews(driver)).items},
        parentInbox: {...(await call('getInbox', parent)).inbox, reviews: (await collectPendingReviews(parent)).items}};
      writeFileSync(resolve(output, phase + '-observed.json'), JSON.stringify({runId: session.runId, observedAt: new Date().toISOString(), state}, null, 2) + '\n', {flag: 'wx', mode: 0o600});
      const result = verifyReviewPhoneCheckpoint(phase, state, fixture);
      for (const [id, original] of historyRows) {
        const {id: savedId, ...saved} = ratings.find(row => row.id === id) ?? {};
        assert.equal(savedId, id); assert.deepEqual(saved, original);
      }
      for (const [id, original] of originalRides) assert.deepEqual((await db.doc('rideSessions/' + id).get()).data(), original);
      if (published) assert.deepEqual((await db.doc('rideSessions/' + fixture.freshRide).get()).data(), freshRideOriginal);
      for (const [path, original] of protectedRows) {
        const current = (await db.doc(path).get()).data();
        if ([`users/${driver.uid}`, `users/${parent.uid}`].includes(path)) {
          const {updatedAt: before, ...old} = original, {updatedAt: after, ...now} = current;
          assert(after.toMillis() >= before.toMillis()); assert.deepEqual(now, old, path);
        } else assert.deepEqual(current, original, path);
      }
      for (const [uid, original] of claims) assert.deepEqual((await auth.getUser(uid)).customClaims ?? {}, original);
      checks.push({...result, protectedRecordCount: protectedRows.size, originalClaimsUnchanged: true});
      console.log('Independent review checkpoint passed: ' + phase);
    }
  }, {firestore: {terminate: async () => {await db.terminate(); firestoreClientTerminated = true;}},
    closeApp: async app => {await deleteApp(app); adminClientClosed = true;}});
} catch (error) {failure = error;}
finally {input.close(); process.removeListener('SIGINT', stop); process.removeListener('SIGTERM', stop); delete process.env.SGM_QA_PASSWORD;}
const files = ['scripts/qa/manual-review-history-phone-session.mjs', 'scripts/qa/review-history-phone-checkpoints.mjs',
  'scripts/qa/review-history-fixture.mjs', 'scripts/qa/review-pagination-client.mjs', 'functions/src/callables/inbox.ts', 'functions/src/callables/feedback.ts'];
writeFileSync(resolve(output, 'session-results.json'), JSON.stringify({projectId: session.projectId, runId: session.runId,
  testedAt: new Date().toISOString(), scope: 'independent-phone-review-records-not-ui-or-release-proof', completed: completed && !failure,
  checks, adminClientClosed, firestoreClientTerminated, productionWrites: false, providerRequests: 0,
  sourceFiles: Object.fromEntries(files.map(file => [file, createHash('sha256').update(readFileSync(resolve(import.meta.dirname, '../..', file))).digest('hex')]))}, null, 2) + '\n', {flag: 'wx', mode: 0o600});
if (failure) throw new Error('Review phone observer failed; retain the original observed state.');

import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdirSync, readFileSync, statSync, writeFileSync} from 'node:fs';
import {dirname, isAbsolute, resolve} from 'node:path';
import {createInterface} from 'node:readline';

const [sessionPath, output, apk] = process.argv.slice(2);
assert([sessionPath, output, apk].every(path => isAbsolute(path ?? '')) && process.stdin.isTTY);
assert.equal(statSync(sessionPath).mode & 0o077, 0); assert.equal(statSync(dirname(sessionPath)).mode & 0o077, 0);
const session = JSON.parse(readFileSync(sessionPath)); assert.equal(session.projectId, 'demo-sgm-local-qa');
process.env.SGM_QA_PASSWORD = session.password;
const {auth, call, db, signIn} = await import('./local-flow-client.mjs');
const {createReviewHistoryFixture, createCompletedReviewRide} = await import('./review-history-fixture.mjs');
const {withLocalAdminCleanup} = await import('./local-admin-lifecycle.mjs');
const {deleteApp} = await import('firebase-admin/app');
mkdirSync(output, {mode: 0o700});
const phases = ['empty-driver', 'historical-driver', 'updated-driver', 'parent', 'empty-manager', 'signed-out'];
const input = createInterface({input: process.stdin, terminal: false}), checks = [];
const stop = () => input.close(); process.once('SIGINT', stop); process.once('SIGTERM', stop);
let failure, completed = false, fixture, preparedNew = false, adminClientClosed = false, firestoreClientTerminated = false;
try {
  await withLocalAdminCleanup(async () => {
    const actors = {driver: await signIn(session.driver), parent: await signIn(session.parent), manager: await signIn(session.manager)};
    const originals = new Map();
    for (const collection of await db.listCollections()) for (const row of (await collection.get()).docs) originals.set(row.ref.path, row.data());
    const claims = new Map((await auth.listUsers()).users.map(row => [row.uid, row.customClaims ?? {}]));
    let savedRatings, savedRides;
    const captureFixture = async () => {
      const ratings = new Map((await db.collection('ratings').get()).docs.map(row => [row.id, row.data()]));
      const rides = new Map((await db.collection('rideSessions').get()).docs.map(row => [row.id, row.data()]));
      for (const [id, original] of savedRatings ?? []) assert.deepEqual(ratings.get(id), original);
      for (const [id, original] of savedRides ?? []) assert.deepEqual(rides.get(id), original);
      savedRatings = ratings; savedRides = rides;
    };
    console.log('Observe phone stages: ' + phases.join(', ') + '.');
    console.log('prepare-history after empty-driver; new-review after historical-driver. Both writes are fixture actions, not phone submissions.');
    for await (const command of input) {
      const phase = command.trim(); if (phase === 'stop') break;
      if (phase === 'finish') {assert.equal(checks.length, phases.length); completed = true; break;}
      if (phase === 'prepare-history') {
        assert.equal(checks.length, 1); assert.equal(fixture, undefined);
        fixture = await createReviewHistoryFixture(actors.driver, actors.parent);
        const authors = [actors.parent, ...await Promise.all(fixture.peers.slice(1).map(uid => signIn(uid + '@example.test')))];
        let index = 0;
        for (const rideSessionId of fixture.rides) for (const author of authors)
          await call('submitRating', author, {rideSessionId, ratedUserId: actors.driver.uid, score: index++ < 46 ? 4 : 3});
        await captureFixture(); assert.equal(savedRatings.size, 208); console.log('104 received reviews prepared, 358 total stars.'); continue;
      }
      if (phase === 'new-review') {
        assert.equal(checks.length, 2); assert.equal(preparedNew, false); preparedNew = true;
        await createCompletedReviewRide(fixture);
        await call('submitRating', actors.parent, {rideSessionId: fixture.freshRide, ratedUserId: actors.driver.uid, score: 5});
        await captureFixture(); assert.equal(savedRatings.size, 209); console.log('One additional received review prepared.'); continue;
      }
      assert.equal(phase, phases[checks.length]); const index = phases.indexOf(phase);
      if (index > 0) assert(fixture); if (index > 1) assert(preparedNew);
      const summaries = Object.fromEntries(await Promise.all(Object.entries(actors).map(async ([name, actor]) =>
        [name, await call('getReceivedRatingSummary', actor)])));
      writeFileSync(resolve(output, phase + '-observed.json'), JSON.stringify({runId: session.runId, phase,
        observedAt: new Date().toISOString(), summaries}, null, 2) + '\n', {flag: 'wx', mode: 0o600});
      assert.deepEqual(summaries.driver, {userId: actors.driver.uid, count: index === 0 ? 0 : index === 1 ? 104 : 105,
        average: index === 0 ? null : index === 1 ? 358 / 104 : 363 / 105});
      assert.deepEqual(summaries.parent, {userId: actors.parent.uid, count: index === 0 ? 0 : 26, average: index === 0 ? null : 4});
      assert.deepEqual(summaries.manager, {userId: actors.manager.uid, count: 0, average: null});
      assert.equal((await db.collection('ratings').get()).size, index === 0 ? 0 : index === 1 ? 208 : 209);
      if (savedRatings) {
        assert.deepEqual(new Map((await db.collection('ratings').get()).docs.map(row => [row.id, row.data()])), savedRatings);
        assert.deepEqual(new Map((await db.collection('rideSessions').get()).docs.map(row => [row.id, row.data()])), savedRides);
      }
      for (const [path, original] of originals) {
        const current = (await db.doc(path).get()).data();
        if (Object.values(actors).some(actor => path === 'users/' + actor.uid)) {
          const {updatedAt: before, ...old} = original, {updatedAt: after, ...now} = current;
          assert(after.toMillis() >= before.toMillis()); assert.deepEqual(now, old, path);
        } else assert.deepEqual(current, original, path);
      }
      for (const [uid, original] of claims) assert.deepEqual((await auth.getUser(uid)).customClaims ?? {}, original);
      checks.push({phase, status: 'passed', driverCount: summaries.driver.count, parentCount: summaries.parent.count,
        managerCount: 0, protectedRecordCount: originals.size, ratingsAndRidesUnchanged: true, originalClaimsUnchanged: true});
      console.log('Independent received-summary checkpoint passed: ' + phase);
    }
  }, {firestore: {terminate: async () => {await db.terminate(); firestoreClientTerminated = true;}},
    closeApp: async app => {await deleteApp(app); adminClientClosed = true;}});
} catch (error) {failure = error;}
finally {input.close(); process.removeListener('SIGINT', stop); process.removeListener('SIGTERM', stop); delete process.env.SGM_QA_PASSWORD;}
const files = ['scripts/qa/manual-received-ratings-phone-session.mjs', 'scripts/qa/review-history-fixture.mjs',
  'functions/src/callables/receivedRatings.ts', 'functions/src/domain/receivedRatings.ts', 'firestore.rules', 'firestore.indexes.json'];
writeFileSync(resolve(output, 'session-results.json'), JSON.stringify({projectId: session.projectId, runId: session.runId,
  testedAt: new Date().toISOString(), scope: 'independent-received-rating-summary-records-not-ui-or-release-proof',
  completed: completed && !failure, checks, adminClientClosed, firestoreClientTerminated, productionWrites: false, providerRequests: 0,
  phoneUiProvenByThisObserver: false, processRestartProven: false, fixtureSubmittedAllRatings: true,
  sourceApkSha256: createHash('sha256').update(readFileSync(apk)).digest('hex'), installedBytesIndependentlyVerified: false,
  sourceFiles: Object.fromEntries(files.map(file => [file, createHash('sha256').update(readFileSync(resolve(import.meta.dirname, '../..', file))).digest('hex')]))}, null, 2) + '\n', {flag: 'wx', mode: 0o600});
if (failure) throw new Error('Received ratings phone observer failed; retain the original observations.');

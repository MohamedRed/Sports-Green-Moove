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
const {collectPendingReviews} = await import('./review-pagination-client.mjs');
const {withLocalAdminCleanup} = await import('./local-admin-lifecycle.mjs');
const {deleteApp} = await import('firebase-admin/app');
mkdirSync(output, {mode: 0o700});
const phases = ['driver-pending31', 'driver-sent', 'parent-first-page', 'parent-more', 'parent-sent', 'signed-out'];
const input = createInterface({input: process.stdin, terminal: false}), checks = [];
const stop = () => input.close(); process.once('SIGINT', stop); process.once('SIGTERM', stop);
let failure, completed = false, adminClientClosed = false, firestoreClientTerminated = false;
try {
  await withLocalAdminCleanup(async () => {
    const driver = await signIn(session.driver), parent = await signIn(session.parent);
    const originals = new Map();
    for (const collection of await db.listCollections()) for (const row of (await collection.get()).docs) originals.set(row.ref.path, row.data());
    const claims = new Map((await auth.listUsers()).users.map(row => [row.uid, row.customClaims ?? {}]));
    const rides = Array.from({length: 31}, (_, index) => 'sgm-page-phone-' + String(index).padStart(3, '0'));
    const batch = db.batch();
    for (const [index, id] of rides.entries()) batch.create(db.doc('rideSessions/' + id), {status: 'completed', driverUserId: driver.uid,
      participantUserIds: index % 2 ? [parent.uid] : [driver.uid, parent.uid]});
    await batch.commit();
    for (const rideSessionId of rides.slice(0, 30)) await call('submitRating', driver, {rideSessionId, ratedUserId: parent.uid, score: 4});
    const originalRatings = new Map((await db.collection('ratings').get()).docs.map(row => [row.id, row.data()]));
    const originalRides = new Map((await db.collection('rideSessions').get()).docs.map(row => [row.id, row.data()]));
    console.log('31 completed rides and 30 fixture-submitted driver ratings prepared. Remaining submissions must come from the phone.');
    console.log('Observe stages: ' + phases.join(', ') + '. finish after signed-out.');
    for await (const command of input) {
      const phase = command.trim(); if (phase === 'stop') break;
      if (phase === 'finish') {assert.equal(checks.length, phases.length); completed = true; break;}
      assert.equal(phase, phases[checks.length]); const index = phases.indexOf(phase);
      const own = await collectPendingReviews(driver), other = await collectPendingReviews(parent);
      assert.equal(own.items.length, index === 0 ? 1 : 0);
      if (index === 0) assert.equal(own.items[0].rideSessionId, rides.at(-1));
      assert.equal(other.items.length, index < 4 ? 31 : 30);
      assert.equal(other.pages[0].items.length, 20); assert(other.pages[0].nextCursor);
      const rows = new Map((await db.collection('ratings').get()).docs.map(row => [row.id, row.data()]));
      assert.equal(rows.size, index === 0 ? 30 : index < 4 ? 31 : 32);
      for (const [id, data] of originalRatings) assert.deepEqual(rows.get(id), data);
      for (const [author, target, needed] of [[driver, parent, index > 0], [parent, driver, index >= 4]]) {
        const id = `${rides.at(-1)}_${author.uid}_${target.uid}`;
        if (needed) assert.deepEqual({...rows.get(id), createdAt: undefined}, {rideSessionId: rides.at(-1), authorUserId: author.uid,
          ratedUserId: target.uid, score: 5, comment: null, createdAt: undefined});
        else assert.equal(rows.has(id), false);
      }
      assert.deepEqual(new Map((await db.collection('rideSessions').get()).docs.map(row => [row.id, row.data()])), originalRides);
      for (const [path, original] of originals) {
        const current = (await db.doc(path).get()).data();
        if ([driver, parent].some(actor => path === 'users/' + actor.uid)) {
          const {updatedAt: before, ...old} = original, {updatedAt: after, ...now} = current;
          assert(after.toMillis() >= before.toMillis()); assert.deepEqual(now, old, path);
        } else assert.deepEqual(current, original, path);
      }
      for (const [uid, original] of claims) assert.deepEqual((await auth.getUser(uid)).customClaims ?? {}, original);
      const record = {runId: session.runId, phase, observedAt: new Date().toISOString(), driverRequests: own.items.length,
        parentRequests: other.items.length, parentPages: other.pages.length, parentFirstPageSize: 20, immutableRatingCount: rows.size,
        protectedRecordCount: originals.size, originalRatingsRidesAndClaimsPreserved: true};
      writeFileSync(resolve(output, phase + '.json'), JSON.stringify(record, null, 2) + '\n', {flag: 'wx', mode: 0o600});
      checks.push({...record, status: 'passed'}); console.log('Independent pending-review checkpoint passed: ' + phase);
    }
  }, {firestore: {terminate: async () => {await db.terminate(); firestoreClientTerminated = true;}},
    closeApp: async app => {await deleteApp(app); adminClientClosed = true;}});
} catch (error) {failure = error;}
finally {input.close(); process.removeListener('SIGINT', stop); process.removeListener('SIGTERM', stop); delete process.env.SGM_QA_PASSWORD;}
const files = ['scripts/qa/manual-review-pagination-phone.mjs', 'scripts/qa/review-pagination-client.mjs',
  'functions/src/callables/inbox.ts', 'functions/src/services/pendingReviews.ts', 'functions/src/domain/pendingReviews.ts'];
writeFileSync(resolve(output, 'session-results.json'), JSON.stringify({projectId: session.projectId, runId: session.runId,
  testedAt: new Date().toISOString(), scope: 'independent-pending-review-record-checkpoints-not-ui-or-release-proof',
  completed: completed && !failure, checks, adminClientClosed, firestoreClientTerminated, productionWrites: false, providerRequests: 0,
  phoneUiProvenByThisObserver: false, fixtureSubmittedInitialRatings: 30, subsequentRatingsFixtureSubmitted: false,
  sourceApkSha256: createHash('sha256').update(readFileSync(apk)).digest('hex'), installedBytesIndependentlyVerified: false,
  sourceFiles: Object.fromEntries(files.map(file => [file, createHash('sha256').update(readFileSync(resolve(import.meta.dirname, '../..', file))).digest('hex')]))}, null, 2) + '\n', {flag: 'wx', mode: 0o600});
if (failure) throw new Error('Pending review phone observer failed; retain the original observations.');

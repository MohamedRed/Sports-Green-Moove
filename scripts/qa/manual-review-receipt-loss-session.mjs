import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {existsSync, readFileSync, statSync, writeFileSync} from 'node:fs';
import {dirname, isAbsolute, resolve} from 'node:path';
import {createInterface} from 'node:readline';
import {openReviewReceiptLossProxy} from './review-receipt-loss-proxy.mjs';

const [handoffPath, appSessionPath, output, apk] = process.argv.slice(2);
assert([handoffPath, appSessionPath, output, apk].every(path => isAbsolute(path ?? '')) && process.stdin.isTTY);
assert.equal(statSync(handoffPath).mode & 0o077, 0); assert.equal(statSync(dirname(handoffPath)).mode & 0o077, 0);
assert.equal(statSync(output).mode & 0o077, 0); assert(!existsSync(appSessionPath));
const handoff = JSON.parse(readFileSync(handoffPath)); assert.equal(handoff.projectId, 'demo-sgm-local-qa');
process.env.SGM_QA_PASSWORD = handoff.password; process.env.SGM_LOCAL_RUN_ID = handoff.runId;
process.env.SGM_LOCAL_UI_SESSION_FILE = appSessionPath;
const {auth, db, signIn, call} = await import('./local-flow-client.mjs');
const {seedLocalUiFixtures} = await import('./local-ui-fixtures.mjs');
const {collectPendingReviews} = await import('./review-pagination-client.mjs');
const {withLocalAdminCleanup} = await import('./local-admin-lifecycle.mjs');
const {deleteApp} = await import('firebase-admin/app');
const phases = ['parent-ready', 'receipt-lost', 'retry-ready', 'parent-confirmed', 'parent-restored', 'driver-summary', 'signed-out'];
const files = ['scripts/qa/manual-review-receipt-loss-session.mjs', 'scripts/qa/review-receipt-loss-proxy.mjs'];
const hashSources = () => Object.fromEntries(files.map(file => [file,
  createHash('sha256').update(readFileSync(resolve(import.meta.dirname, '../..', file))).digest('hex')]));
const sourceFiles = hashSources();
const input = createInterface({input: process.stdin, terminal: false}), checks = [];
const stop = () => input.close(); process.once('SIGINT', stop); process.once('SIGTERM', stop);
let proxy, completed = false, failure, adminClientClosed = false, firestoreClientTerminated = false, firstRating;
const save = (name, value) => writeFileSync(resolve(output, name + '.json'), JSON.stringify(value, null, 2) + '\n', {mode: 0o600, flag: 'wx'});
try {
  await withLocalAdminCleanup(async () => {
    proxy = await openReviewReceiptLossProxy({runId: handoff.runId, verifyIdentity: token => auth.verifyIdToken(token)});
    const session = await seedLocalUiFixtures();
    assert.equal(session.runId, handoff.runId);
    const parent = await signIn(session.parent), driver = await signIn(session.driver), originals = new Map();
    for (const collection of await db.listCollections()) for (const row of (await collection.get()).docs) originals.set(row.ref.path, row.data());
    const claims = new Map((await auth.listUsers()).users.map(row => [row.uid, row.customClaims ?? {}]));
    const base = originals.get('trips/' + session.multiSeatTripId), prepared = new Map(), batch = db.batch();
    const rides = [28, 29].map(day => ({id: 'sgm-receipt-loss-' + day, tripId: 'sgm-receipt-trip-' + day,
      departureAt: `2026-10-${day}T17:45:00Z`, departureLabel: `${day} octobre 2026 à 18:45`}));
    for (const ride of rides) {
      const trip = {...base, id: ride.tripId, title: 'Entraînement U12', departureAt: ride.departureAt,
        status: 'completed', activeRideSessionId: ride.id};
      const data = {tripId: ride.tripId, status: 'completed', driverUserId: driver.uid, participantUserIds: [parent.uid]};
      for (const [path, value] of [['trips/' + ride.tripId, trip], ['rideSessions/' + ride.id, data]]) {
        batch.create(db.doc(path), value); prepared.set(path, value);
      }
    }
    await batch.commit(); assert.equal((await db.collection('ratings').get()).size, 0);
    const selected = rides[1], ratingId = `${selected.id}_${parent.uid}_${driver.uid}`;
    proxy.arm({uid: parent.uid, ratingId, data: {rideSessionId: selected.id, ratedUserId: driver.uid, score: 5}});
    save('fixture', {runId: handoff.runId, rides, selectedRideId: selected.id, ratingId, fixtureSubmittedRatings: 0});
    console.log('Review receipt-loss fixture ready. Only the phone may submit the rating.');
    console.log('Observe ' + phases.join(', ') + ', then finish. stop retains a partial attempt.');
    for await (const raw of input) {
      const phase = raw.trim(); if (phase === 'stop') break;
      if (phase === 'finish') {assert.equal(checks.length, phases.length); completed = true; break;}
      assert.equal(phase, phases[checks.length]); assert.equal(proxy.receipt.failed, false);
      const rated = checks.length > 0;
      const parentRows = (await collectPendingReviews(parent)).items, driverRows = (await collectPendingReviews(driver)).items;
      assert.deepEqual(parentRows.map(row => row.rideSessionId).sort(), rides.filter(row => !rated || row.id !== selected.id).map(row => row.id).sort());
      assert.deepEqual(driverRows.map(row => row.rideSessionId).sort(), rides.map(row => row.id).sort());
      for (const rows of [parentRows, driverRows]) for (const row of rows) {
        const ride = rides.find(ride => ride.id === row.rideSessionId);
        assert.deepEqual(row.tripContext, {tripId: ride.tripId, title: 'Entraînement U12', departureAt: ride.departureAt, departureLabel: ride.departureLabel});
      }
      const ratings = (await db.collection('ratings').get()).docs;
      assert.equal(ratings.length, Number(rated));
      if (rated) {
        assert.equal(ratings[0].id, ratingId); const row = ratings[0].data();
        assert.equal(row.rideSessionId, selected.id); assert.equal(row.authorUserId, parent.uid);
        assert.equal(row.ratedUserId, driver.uid); assert.equal(row.score, 5); assert.equal(row.comment, null);
        if (!firstRating) firstRating = row; else assert.deepEqual(row, firstRating, 'An identical retry must retain the original timestamp and fields');
      }
      assert.deepEqual(await call('getReceivedRatingSummary', parent), {userId: parent.uid, average: null, count: 0});
      assert.deepEqual(await call('getReceivedRatingSummary', driver), {userId: driver.uid, average: rated ? 5 : null, count: Number(rated)});
      for (const [path, original] of [...originals, ...prepared]) {
        const now = (await db.doc(path).get()).data();
        if ([parent, driver].some(actor => path === 'users/' + actor.uid)) {
          const {updatedAt: oldTime, ...old} = original, {updatedAt: newTime, ...after} = now;
          assert(newTime.toMillis() >= oldTime.toMillis()); assert.deepEqual(after, old, path);
        } else assert.deepEqual(now, original, path);
      }
      for (const [uid, before] of claims) assert.deepEqual((await auth.getUser(uid)).customClaims ?? {}, before);
      const paths = [];
      for (const collection of await db.listCollections()) for (const row of (await collection.get()).docs) paths.push(row.ref.path);
      assert.deepEqual(paths.sort(), [...originals.keys(), ...prepared.keys(), ...(rated ? ['ratings/' + ratingId] : [])].sort());
      if (phase === 'receipt-lost' || phase === 'retry-ready') {
        assert.equal(proxy.receipt.phase, 'lost'); assert.equal(proxy.receipt.attempts[0].upstreamAcknowledged, true);
        assert.equal(proxy.receipt.attempts[0].responseReleased, false);
      }
      if (phase === 'retry-ready') proxy.recover();
      if (checks.length >= 3) assert.equal(proxy.receipt.attempts.filter(row => row.responseReleased).length, 1);
      const check = {phase, observedAt: new Date().toISOString(), status: 'passed', ratingCount: ratings.length,
        parentRequests: parentRows.length, driverRequests: driverRows.length, originalTimestampAndFieldsPreserved: rated,
        originalRecordsAndClaimsPreserved: true, proxy: structuredClone(proxy.receipt), phoneUiProvenByObserver: false};
      save(phase, check); checks.push(check); console.log('Independent receipt-loss checkpoint passed: ' + phase);
    }
  }, {firestore: {terminate: async () => {await db.terminate(); firestoreClientTerminated = true;}},
    closeApp: async app => {await deleteApp(app); adminClientClosed = true;}});
} catch (error) {failure = error;}
finally {
  input.close(); await proxy?.close(); process.removeListener('SIGINT', stop); process.removeListener('SIGTERM', stop);
  delete process.env.SGM_QA_PASSWORD; delete process.env.SGM_LOCAL_UI_SESSION_FILE; delete process.env.SGM_LOCAL_RUN_ID;
}
const sourceFilesUnchanged = JSON.stringify(sourceFiles) === JSON.stringify(hashSources());
if (!sourceFilesUnchanged) failure ??= Object.assign(new Error('Controller source changed'), {code: 'SOURCE_CHANGED'});
save('session-results', {runId: handoff.runId, projectId: handoff.projectId, completed: completed && !failure, checks,
  failedCheckpoint: failure ? phases[checks.length] ?? 'finish' : null, failureKind: failure?.code ?? failure?.name ?? null,
  proxy: proxy?.receipt ?? null, adminClientClosed, firestoreClientTerminated, fixtureSubmittedRatings: 0,
  controllerSubmittedRatings: false, phoneUiProvenByObserver: false, realWorldRadioLossProven: false,
  installedBytesIndependentlyVerified: false, productionWrites: false, mapRequests: 0, realPayments: false,
  sourceApkSha256: createHash('sha256').update(readFileSync(apk)).digest('hex'),
  sourceFiles, sourceFilesUnchanged});
if (failure) throw new Error('Review receipt-loss trial failed; retain its original observations.');

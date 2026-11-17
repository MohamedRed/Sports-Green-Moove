import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdirSync, readFileSync, statSync, writeFileSync} from 'node:fs';
import {dirname, isAbsolute, resolve} from 'node:path';
import {createInterface} from 'node:readline';
import {reviewNetworkPhases, verifyReviewNetworkState} from './review-network-phone-checkpoints.mjs';

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
const input = createInterface({input: process.stdin, terminal: false}), checks = [];
const stop = () => input.close(); process.once('SIGINT', stop); process.once('SIGTERM', stop);
let failure, completed = false, adminClientClosed = false, firestoreClientTerminated = false, fixture;
try {
  await withLocalAdminCleanup(async () => {
    const driver = await signIn(session.driver), parent = await signIn(session.parent), originals = new Map();
    for (const collection of await db.listCollections()) for (const row of (await collection.get()).docs) originals.set(row.ref.path, row.data());
    const claims = new Map((await auth.listUsers()).users.map(row => [row.uid, row.customClaims ?? {}]));
    const base = originals.get('trips/' + session.multiSeatTripId); assert.equal(base.driverUserId, driver.uid);
    fixture = {parentUid: parent.uid, driverUid: driver.uid, selectedRideId: 'sgm-network-review-29',
      rides: [28, 29].map(day => ({id: 'sgm-network-review-' + day, tripId: 'sgm-network-trip-' + day,
        departureAt: `2026-10-${day}T17:45:00Z`, departureLabel: `${day} octobre 2026 à 18:45`}))};
    const batch = db.batch(), prepared = new Map();
    for (const ride of fixture.rides) {
      const trip = {...base, id: ride.tripId, title: 'Entraînement U12', departureAt: ride.departureAt,
        status: 'completed', activeRideSessionId: ride.id};
      const session = {tripId: ride.tripId, status: 'completed', driverUserId: driver.uid, participantUserIds: [parent.uid]};
      for (const [path, data] of [['trips/' + ride.tripId, trip], ['rideSessions/' + ride.id, session]]) {
        batch.create(db.doc(path), data); prepared.set(path, data);
      }
    }
    await batch.commit(); assert.equal((await db.collection('ratings').get()).size, 0);
    writeFileSync(resolve(output, 'fixture.json'), JSON.stringify({runId: session.runId, fixture,
      scope: 'two-completed-fixture-rides-not-phone-ride-or-network-proof', fixtureSubmittedRatings: 0}, null, 2) + '\n', {flag: 'wx', mode: 0o600});
    console.log('Two same-name completed test trips prepared, with no ratings. Only the phone may submit a rating.');
    console.log('Observe: ' + reviewNetworkPhases.join(', ') + '. finish after signed-out.');
    for await (const command of input) {
      const phase = command.trim(); if (phase === 'stop') break;
      if (phase === 'finish') {assert.equal(checks.length, reviewNetworkPhases.length); completed = true; break;}
      assert.equal(phase, reviewNetworkPhases[checks.length]);
      const own = await collectPendingReviews(parent), other = await collectPendingReviews(driver);
      const state = {parent: own.items, driver: other.items,
        ratings: (await db.collection('ratings').get()).docs.map(row => ({id: row.id, ...row.data()})),
        parentSummary: await call('getReceivedRatingSummary', parent), driverSummary: await call('getReceivedRatingSummary', driver)};
      const check = verifyReviewNetworkState(phase, state, fixture);
      for (const [path, data] of prepared) assert.deepEqual((await db.doc(path).get()).data(), data, path);
      for (const [path, before] of originals) {
        const after = (await db.doc(path).get()).data();
        if ([parent, driver].some(actor => path === 'users/' + actor.uid)) {
          const {updatedAt: oldTime, ...old} = before, {updatedAt: newTime, ...now} = after;
          assert(newTime.toMillis() >= oldTime.toMillis()); assert.deepEqual(now, old, path);
        } else assert.deepEqual(after, before, path);
      }
      for (const [uid, original] of claims) assert.deepEqual((await auth.getUser(uid)).customClaims ?? {}, original);
      const record = {...check, runId: session.runId, observedAt: new Date().toISOString(),
        originalRecordsAndClaimsPreserved: true, protectedRecordCount: originals.size, summaries: [state.parentSummary, state.driverSummary]};
      writeFileSync(resolve(output, phase + '.json'), JSON.stringify(record, null, 2) + '\n', {flag: 'wx', mode: 0o600});
      checks.push(record); console.log('Independent network-review record checkpoint passed: ' + phase);
    }
  }, {firestore: {terminate: async () => {await db.terminate(); firestoreClientTerminated = true;}},
    closeApp: async app => {await deleteApp(app); adminClientClosed = true;}});
} catch (error) {failure = error;}
finally {input.close(); process.removeListener('SIGINT', stop); process.removeListener('SIGTERM', stop); delete process.env.SGM_QA_PASSWORD;}
const files = ['scripts/qa/manual-review-network-phone.mjs', 'scripts/qa/review-network-phone-checkpoints.mjs',
  'functions/src/callables/feedback.ts', 'functions/src/services/ratingSubmission.ts', 'functions/src/domain/ratingSubmission.ts'];
writeFileSync(resolve(output, 'session-results.json'), JSON.stringify({projectId: session.projectId, runId: session.runId,
  testedAt: new Date().toISOString(), scope: 'independent-review-network-record-checkpoints-not-ui-or-release-proof',
  completed: completed && !failure, checks, adminClientClosed, firestoreClientTerminated, productionWrites: false, providerRequests: 0,
  fixtureSubmittedRatings: 0, controllerSubmittedRatings: false, phoneUiProvenByObserver: false, physicalNetworkLossProvenByObserver: false,
  sourceApkSha256: createHash('sha256').update(readFileSync(apk)).digest('hex'), installedBytesIndependentlyVerified: false,
  sourceFiles: Object.fromEntries(files.map(file => [file, createHash('sha256').update(readFileSync(resolve(import.meta.dirname, '../..', file))).digest('hex')]))}, null, 2) + '\n', {flag: 'wx', mode: 0o600});
if (failure) throw new Error('Network-review phone observer failed; retain the original observations.');

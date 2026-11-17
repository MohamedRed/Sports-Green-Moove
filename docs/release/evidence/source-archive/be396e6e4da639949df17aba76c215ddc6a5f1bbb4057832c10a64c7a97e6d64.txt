import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {deleteApp} from 'firebase-admin/app';
import {Timestamp} from 'firebase-admin/firestore';
import {auth, call, db, signIn} from './local-flow-client.mjs';
import {seedLocalUiFixtures} from './local-ui-fixtures.mjs';
import {withLocalAdminCleanup} from './local-admin-lifecycle.mjs';

let report, adminClientClosed = false, firestoreClientTerminated = false;
await withLocalAdminCleanup(async () => {
  await seedLocalUiFixtures();
  const driver = await signIn('d@example.test'), parent = await signIn('p@example.test');
  const originals = new Map();
  for (const collection of await db.listCollections()) for (const row of (await collection.get()).docs) originals.set(row.ref.path, row.data());
  const claims = await Promise.all([driver, parent].map(async actor => (await auth.getUser(actor.uid)).customClaims));
  const rides = Array.from({length: 31}, (_, index) => 'sgm-review-window-' + String(index).padStart(3, '0'));
  for (const [index, rideSessionId] of rides.entries()) {
    await db.doc('rideSessions/' + rideSessionId).create({driverUserId: driver.uid, participantUserIds: [driver.uid, parent.uid],
      status: 'completed', completedAt: Timestamp.now()});
    if (index < 30) await call('submitRating', driver, {rideSessionId, ratedUserId: parent.uid, score: 4});
  }
  const before = (await db.collection('ratings').get()).docs.map(row => ({id: row.id, data: row.data()}));
  const driverInbox = (await call('getInbox', driver)).inbox, parentInbox = (await call('getInbox', parent)).inbox;
  const freshRide = rides.at(-1), omittedRatingId = `${freshRide}_${driver.uid}_${parent.uid}`;
  assert.equal((await db.doc('rideSessions/' + freshRide).get()).data().status, 'completed');
  assert.equal((await db.doc('ratings/' + omittedRatingId).get()).exists, false);
  assert.equal(driverInbox.reviews.length, 0); assert.equal(parentInbox.reviews.length, 30);
  assert(!parentInbox.reviews.some(row => row.rideSessionId === freshRide));
  assert.equal((await db.collection('rideSessions').where('driverUserId', '==', driver.uid).get()).size, 31);
  assert.deepEqual((await db.collection('ratings').get()).docs.map(row => ({id: row.id, data: row.data()})), before);
  for (const [path, data] of originals) assert.deepEqual((await db.doc(path).get()).data(), data);
  assert.deepEqual(await Promise.all([driver, parent].map(async actor => (await auth.getUser(actor.uid)).customClaims)), claims);
  report = {scope: 'controlled-isolated-reproduction-of-open-review-window-gap-not-a-passing-flow',
    projectId: 'demo-sgm-local-qa', runId: process.env.SGM_LOCAL_RUN_ID, observedAt: new Date().toISOString(), gapReproduced: true,
    completedRideCount: 31, immutableRatingCount: 30, expectedDriverPrompts: 1, observedDriverPrompts: driverInbox.reviews.length,
    expectedParentPrompts: 31, observedParentPrompts: parentInbox.reviews.length, omittedRideId: freshRide,
    omittedRatingId, omittedRideCompleted: true, omittedDriverRatingAbsent: true, protectedRecordCount: originals.size,
    originalRecordsAndClaimsUnchanged: true, productionWrites: false, phoneUiExecuted: false, providerRequests: 0};
}, {firestore: {terminate: async () => {await db.terminate(); firestoreClientTerminated = true;}},
  closeApp: async app => {await deleteApp(app); adminClientClosed = true;}});
const files = ['scripts/qa/review-request-window-probe.mjs', 'functions/src/callables/inbox.ts', 'functions/src/domain/inbox.ts'];
writeFileSync(process.env.SGM_LOCAL_FLOW_OUTPUT, JSON.stringify({...report, adminClientClosed, firestoreClientTerminated,
  sourceFiles: Object.fromEntries(files.map(file => [file, createHash('sha256').update(readFileSync(resolve(import.meta.dirname, '../..', file))).digest('hex')]))}, null, 2) + '\n', {flag: 'wx'});
console.log('Open 30-ride window gap reproduced; no successful review discovery claim.');

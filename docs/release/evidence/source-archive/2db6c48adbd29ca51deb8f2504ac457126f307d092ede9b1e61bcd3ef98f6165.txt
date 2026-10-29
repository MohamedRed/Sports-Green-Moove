import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {deleteApp} from 'firebase-admin/app';
import {auth, call, db, denied, signIn} from './local-flow-client.mjs';
import {seedLocalUiFixtures} from './local-ui-fixtures.mjs';
import {withLocalAdminCleanup} from './local-admin-lifecycle.mjs';
import {collectPendingReviews} from './review-pagination-client.mjs';

const steps = [], observations = {}, root = resolve(import.meta.dirname, '../..');
const sources = ['functions/src/callables/inbox.ts', 'functions/src/callables/pendingReviews.ts', 'functions/src/callables/feedback.ts',
  'functions/src/services/pendingReviews.ts', 'functions/src/domain/pendingReviews.ts', 'functions/src/domain/inbox.ts',
  'functions/src/domain/reviewTripContext.ts', 'scripts/qa/local-review-context.mjs', 'scripts/qa/run-local-review-context.mjs'];
const sourceFiles = Object.fromEntries(sources.map(file => [file, createHash('sha256').update(readFileSync(resolve(root, file))).digest('hex')]));
let failure, protectedRecordCount = 0, adminClientClosed = false, firestoreClientTerminated = false;
async function check(id, action) {
  try {await action(); steps.push({id, status: 'passed'});}
  catch (error) {steps.push({id, status: 'failed', error: error.code ?? error.name}); throw error;}
  finally {console.log(`${id}: ${steps.at(-1).status}`);}
}
try {
  await withLocalAdminCleanup(async () => {
    await seedLocalUiFixtures();
    const parent = await signIn('p@example.test'), driver = await signIn('d@example.test'), manager = await signIn('c@example.test');
    const actors = [parent, driver, manager], originals = new Map();
    for (const collection of await db.listCollections()) for (const row of (await collection.get()).docs) originals.set(row.ref.path, row.data());
    const claims = await Promise.all(actors.map(async actor => (await auth.getUser(actor.uid)).customClaims));
    protectedRecordCount = originals.size;
    const rides = Array.from({length: 25}, (_, index) => 'sgm-review-context-' + String(index).padStart(2, '0'));
    const batch = db.batch(), prepared = new Map();
    const create = (path, data) => {batch.create(db.doc(path), data); prepared.set(path, data);};
    const title = 'Entraînement U12', date = index => index % 2 ? '2026-06-01T22:30:00Z' : '2026-10-29T17:45:00Z';
    for (const [index, ride] of rides.entries()) {
      create('rideSessions/' + ride, {tripId: ride, status: 'completed', driverUserId: driver.uid, participantUserIds: [parent.uid]});
      create('trips/' + ride, {status: 'completed', driverUserId: driver.uid, activeRideSessionId: ride, title,
        departureAt: date(index), privateNote: 'must-not-be-returned', origin: {lat: 0, lng: 0}});
    }
    const invalid = ['missing-trip', 'wrong-driver', 'wrong-ride', 'invalid-date', 'missing-title', 'unfinished-trip', 'invalid-path'];
    for (const kind of invalid) {
      const ride = 'sgm-review-context-invalid-' + kind;
      create('rideSessions/' + ride, {tripId: kind === 'invalid-path' ? 'private/nested/path' : ride,
        status: 'completed', driverUserId: driver.uid, participantUserIds: [parent.uid]});
      if (['missing-trip', 'invalid-path'].includes(kind)) continue;
      const data = {status: 'completed', driverUserId: driver.uid, activeRideSessionId: ride, title, departureAt: date(0)};
      if (kind === 'wrong-driver') data.driverUserId = manager.uid;
      if (kind === 'wrong-ride') data.activeRideSessionId = 'foreign-ride';
      if (kind === 'invalid-date') data.departureAt = 'not-a-date';
      if (kind === 'missing-title') delete data.title;
      if (kind === 'unfinished-trip') data.status = 'published';
      create('trips/' + ride, data);
    }
    create('rideSessions/sgm-review-context-foreign', {tripId: 'foreign', status: 'completed', driverUserId: manager.uid, participantUserIds: [manager.uid]});
    create('trips/foreign', {status: 'completed', driverUserId: manager.uid, activeRideSessionId: 'sgm-review-context-foreign',
      title: 'Private foreign trip', departureAt: date(0)});
    await batch.commit();
    let parentPages, driverPages;
    await check('inbox-context-comes-from-the-selected-completed-trip-with-explicit-local-time', async () => {
      const inbox = (await call('getInbox', parent)).inbox;
      assert.equal(inbox.reviews.length, 20); assert(inbox.reviewsNextCursor);
      for (const [index, row] of inbox.reviews.entries()) {
        assert.equal(row.rideSessionId, rides[index]); assert.equal(row.ratedUserId, driver.uid);
        assert.deepEqual(row.tripContext, {tripId: rides[index], title, departureAt: date(index),
          departureLabel: index % 2 ? '02 juin 2026 à 00:30' : '29 octobre 2026 à 18:45'});
      }
      observations.firstPage = {reviews: inbox.reviews.length, currentContextCount: inbox.reviews.filter(row => row.tripContext).length};
    });
    await check('both-accounts-reach-all-contexts-through-the-same-pagination-contract', async () => {
      parentPages = await collectPendingReviews(parent); driverPages = await collectPendingReviews(driver);
      for (const result of [parentPages, driverPages]) {
        assert.equal(result.pages.length, 2); assert.equal(result.items.length, 32);
        assert.equal(result.items.filter(row => row.tripContext?.title === title).length, 25);
        for (const [index, ride] of rides.entries()) assert.equal(result.items.find(row => row.rideSessionId === ride).tripContext.departureAt, date(index));
      }
      observations.pagination = {accounts: 2, pagesPerAccount: 2, contextualRequestsPerAccount: 25, unavailableRequestsPerAccount: 7};
    });
    await check('missing-or-unrelated-details-remain-explicitly-unavailable-without-dropping-the-review', async () => {
      for (const kind of invalid) {
        const row = parentPages.items.find(row => row.rideSessionId === 'sgm-review-context-invalid-' + kind);
        assert(row); assert.equal(row.tripContext, null);
      }
      assert(!JSON.stringify(parentPages).includes('privateNote')); assert(!JSON.stringify(parentPages).includes('must-not-be-returned'));
      assert(!parentPages.items.some(row => row.tripContext?.title === 'Private foreign trip'));
    });
    await check('discovery-does-not-write-any-prepared-or-original-record-or-claim', async () => {
      for (const [path, data] of [...originals, ...prepared]) assert.deepEqual((await db.doc(path).get()).data(), data, path);
      assert.equal((await db.collection('ratings').get()).size, 0);
      assert.deepEqual(await Promise.all(actors.map(async actor => (await auth.getUser(actor.uid)).customClaims)), claims);
    });
    await check('another-account-cannot-request-parent-context-or-reuse-its-cursor', async () => {
      const cursor = parentPages.pages[0].nextCursor;
      await denied('getPendingReviews', driver, {cursor}, 'PERMISSION_DENIED');
      await denied('getPendingReviews', null, {}, 'UNAUTHENTICATED');
      await denied('getPendingReviews', manager, {userId: parent.uid}, 'INVALID_ARGUMENT');
      const own = await collectPendingReviews(manager);
      assert(own.items.every(row => row.ratedUserId !== driver.uid));
    });
    await check('rating-a-later-context-removes-only-that-ride-and-leaves-the-other-account-untouched', async () => {
      const ride = rides[24], before = parentPages.items.find(row => row.rideSessionId === ride);
      assert.equal(before.tripContext.title, title);
      await call('submitRating', parent, {rideSessionId: before.rideSessionId, ratedUserId: before.ratedUserId, score: 5});
      const remaining = await collectPendingReviews(parent), others = await collectPendingReviews(driver);
      assert.equal(remaining.items.length, 31); assert(!remaining.items.some(row => row.rideSessionId === ride));
      assert.deepEqual(others.items, driverPages.items);
      await denied('submitRating', parent, {rideSessionId: ride, ratedUserId: driver.uid, score: 1}, 'ALREADY_EXISTS');
      observations.submission = {score: 5, parentRemaining: remaining.items.length, driverUnchanged: true, ratingCount: (await db.collection('ratings').get()).size};
    });
    await check('review-label-enrichment-and-submission-preserve-all-trip-records-and-account-claims', async () => {
      for (const [path, data] of [...originals, ...prepared]) assert.deepEqual((await db.doc(path).get()).data(), data, path);
      assert.deepEqual(await Promise.all(actors.map(async actor => (await auth.getUser(actor.uid)).customClaims)), claims);
    });
  }, {firestore: {terminate: async () => {await db.terminate(); firestoreClientTerminated = true;}},
    closeApp: async app => {await deleteApp(app); adminClientClosed = true;}});
} catch (error) {failure = error;}
writeFileSync(process.env.SGM_LOCAL_FLOW_OUTPUT, JSON.stringify({projectId: 'demo-sgm-local-qa', runId: process.env.SGM_LOCAL_RUN_ID,
  testedAt: new Date().toISOString(), scope: 'authenticated-isolated-review-trip-context-not-phone-or-production',
  completed: !failure, steps, observations, protectedRecordCount, adminClientClosed, firestoreClientTerminated,
  productionWrites: false, phoneUiExecuted: false, providerRequests: 0, sourceFiles}, null, 2) + '\n', {flag: 'wx'});
if (failure) throw new Error('Review context failed; inspect the sanitized receipt.');

import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {deleteApp} from 'firebase-admin/app';
import {auth, call, db, denied, signIn} from './local-flow-client.mjs';
import {seedLocalUiFixtures} from './local-ui-fixtures.mjs';
import {withLocalAdminCleanup} from './local-admin-lifecycle.mjs';
import {createReviewHistoryFixture, createCompletedReviewRide} from './review-history-fixture.mjs';

const root = resolve(import.meta.dirname, '../..'), steps = [], observations = [];
const sources = ['scripts/qa/run-local-review-history.mjs', 'scripts/qa/local-review-history.mjs',
  'scripts/qa/review-history-fixture.mjs',
  'functions/src/callables/inbox.ts', 'functions/src/domain/inbox.ts', 'functions/src/callables/feedback.ts'];
const sourceFiles = Object.fromEntries(sources.map(file => [file, createHash('sha256').update(readFileSync(resolve(root, file))).digest('hex')]));
let failure, adminClientClosed = false, firestoreClientTerminated = false, ratingsSubmitted = 0, protectedRecordCount = 0;
async function check(id, action) {
  try {await action(); steps.push({id, status: 'passed'});}
  catch (error) {steps.push({id, status: 'failed', error: error.code ?? error.name}); throw error;}
  finally {console.log(`${id}: ${steps.at(-1).status}`);}
}
try {
  await withLocalAdminCleanup(async () => {
    await seedLocalUiFixtures();
    const driver = await signIn('d@example.test'), parent = await signIn('p@example.test');
    const protectedRows = new Map();
    for (const collection of await db.listCollections()) for (const row of (await collection.get()).docs)
      protectedRows.set(row.ref.path, row.data());
    const originalClaims = await Promise.all([driver, parent].map(async actor => (await auth.getUser(actor.uid)).customClaims));
    let fixture;
    await check('104-immutable-ratings-created-through-authenticated-callable', async () => {
      fixture = await createReviewHistoryFixture(driver, parent); ratingsSubmitted = 104;
      assert.equal(ratingsSubmitted, 104);
      assert.equal((await db.collection('ratings').where('authorUserId', '==', driver.uid).get()).size, 104);
    });
    const {rides, freshRide} = fixture;
    await check('submitted-reviews-do-not-reappear-beyond-the-first-100-ratings', async () => {
      const {inbox} = await call('getInbox', driver);
      const repeated = inbox.reviews.filter(row => rides.includes(row.rideSessionId));
      observations.push({phase: '104-rated', displayedAlreadyRatedPrompts: repeated.length, displayedIds: repeated.map(row => row.id)});
      assert.equal(repeated.length, 0, 'Already-submitted reviews must remain absent beyond the history window');
    });
    await check('one-new-unrated-ride-keeps-exactly-one-distinct-prompt', async () => {
      await createCompletedReviewRide(fixture);
      const {inbox} = await call('getInbox', driver);
      assert.equal(inbox.reviews.length, 1); assert.equal(inbox.reviews[0].rideSessionId, freshRide);
      assert.equal(inbox.reviews[0].ratedUserId, parent.uid);
      assert.equal(new Set(inbox.reviews.map(row => row.id)).size, 1);
      observations.push({phase: 'new-unrated', displayedPrompts: inbox.reviews.length});
    });
    await check('another-accounts-ratings-cannot-hide-the-parents-own-prompts', async () => {
      const {inbox} = await call('getInbox', parent);
      const own = inbox.reviews.filter(row => [...rides, freshRide].includes(row.rideSessionId));
      assert.equal(own.length, 27); assert(own.every(row => row.ratedUserId === driver.uid));
      observations.push({phase: 'other-account', displayedPrompts: own.length});
    });
    await check('new-submission-disappears-and-repeated-refresh-stays-empty', async () => {
      await call('submitRating', driver, {rideSessionId: freshRide, ratedUserId: parent.uid, score: 5}); ratingsSubmitted++;
      for (let i = 0; i < 3; i++) assert.deepEqual((await call('getInbox', driver)).inbox.reviews, []);
      await denied('submitRating', driver, {rideSessionId: freshRide, ratedUserId: parent.uid, score: 1}, 'ALREADY_EXISTS');
      assert.equal((await db.collection('ratings').where('authorUserId', '==', driver.uid).get()).size, 105);
      observations.push({phase: 'refreshed', repeatedRefreshes: 3, displayedPrompts: 0, authoredRatings: 105});
    });
    await check('parent-submission-hides-only-that-parents-own-review', async () => {
      await call('submitRating', parent, {rideSessionId: freshRide, ratedUserId: driver.uid, score: 3}); ratingsSubmitted++;
      const own = (await call('getInbox', parent)).inbox.reviews.filter(row => [...rides, freshRide].includes(row.rideSessionId));
      assert.equal(own.length, 26); assert(!own.some(row => row.rideSessionId === freshRide));
      assert.deepEqual((await call('getInbox', driver)).inbox.reviews, []);
    });
    await check('unauthenticated-inbox-is-denied-without-changing-fixture-data', async () => {
      await denied('getInbox', null, {}, 'UNAUTHENTICATED');
      for (const [path, data] of protectedRows) assert.deepEqual((await db.doc(path).get()).data(), data, path);
      assert.deepEqual(await Promise.all([driver, parent].map(async actor => (await auth.getUser(actor.uid)).customClaims)), originalClaims);
      protectedRecordCount = protectedRows.size;
    });
  }, {firestore: {terminate: async () => {await db.terminate(); firestoreClientTerminated = true;}},
    closeApp: async app => {await deleteApp(app); adminClientClosed = true;}});
} catch (error) {failure = error;}
writeFileSync(process.env.SGM_LOCAL_FLOW_OUTPUT, JSON.stringify({projectId: 'demo-sgm-local-qa', runId: process.env.SGM_LOCAL_RUN_ID,
  testedAt: new Date().toISOString(), scope: 'authenticated-isolated-review-history-not-phone-or-production',
  completed: !failure, steps, observations, ratingsSubmitted, protectedRecordCount, adminClientClosed, firestoreClientTerminated,
  productionWrites: false, providerRequests: 0, phoneUiExecuted: false, sourceFiles}, null, 2) + '\n', {flag: 'wx'});
if (failure) throw new Error('Review history check failed; inspect the sanitized result receipt.');

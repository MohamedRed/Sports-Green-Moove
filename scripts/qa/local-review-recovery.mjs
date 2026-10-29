import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync, writeFileSync} from 'node:fs';
import {createServer} from 'node:http';
import {resolve} from 'node:path';
import {deleteApp} from 'firebase-admin/app';
import {auth, call, db, denied, signIn} from './local-flow-client.mjs';
import {seedLocalUiFixtures} from './local-ui-fixtures.mjs';
import {withLocalAdminCleanup} from './local-admin-lifecycle.mjs';
import {collectPendingReviews} from './review-pagination-client.mjs';

const checks = [], attempts = [], root = resolve(import.meta.dirname, '../..');
const sources = ['scripts/qa/local-review-recovery.mjs', 'scripts/qa/run-local-review-recovery.mjs',
  'functions/src/callables/feedback.ts', 'functions/src/services/ratingSubmission.ts', 'functions/src/domain/ratingSubmission.ts'];
let failure, completed = false, adminClientClosed = false, firestoreClientTerminated = false, protectedRecordCount = 0;
const check = async (id, action) => {
  try {await action(); checks.push({id, status: 'passed'});}
  catch (error) {checks.push({id, status: 'failed', code: error.code ?? error.name}); throw error;}
  finally {console.log(id + ': ' + checks.at(-1).status);}
};
try {
  await withLocalAdminCleanup(async () => {
    await seedLocalUiFixtures();
    const parent = await signIn('p@example.test'), driver = await signIn('d@example.test'), manager = await signIn('c@example.test');
    const originals = new Map(), actors = [parent, driver, manager];
    for (const collection of await db.listCollections()) for (const row of (await collection.get()).docs) originals.set(row.ref.path, row.data());
    const claims = await Promise.all(actors.map(async actor => (await auth.getUser(actor.uid)).customClaims));
    protectedRecordCount = originals.size;
    const rides = ['sgm-review-retry-28', 'sgm-review-retry-29', 'sgm-review-retry-concurrent'];
    const prepared = new Map(), batch = db.batch();
    for (const [index, id] of rides.entries()) {
      const ride = {tripId: id, status: 'completed', driverUserId: driver.uid, participantUserIds: [parent.uid]};
      const trip = {activeRideSessionId: id, status: 'completed', driverUserId: driver.uid,
        title: 'Entraînement U12', departureAt: `2026-10-${28 + Number(index > 0)}T17:45:00Z`};
      for (const [collection, data] of [['rideSessions', ride], ['trips', trip]]) {
        const ref = db.collection(collection).doc(id); batch.create(ref, data); prepared.set(ref.path, data);
      }
    }
    await batch.commit();
    let mode = 'drop-before', selected = {rideSessionId: rides[1], ratedUserId: driver.uid, score: 5};
    const server = createServer((request, response) => {
      void (async () => {
        assert.equal(request.method, 'POST'); assert.equal(request.url, '/submitRating');
        assert.equal(request.headers.authorization, 'Bearer ' + parent.token);
        let body = ''; for await (const chunk of request) {body += chunk; assert(body.length <= 4096);}
        const input = JSON.parse(body); assert.deepEqual(input, {data: selected});
        const observation = {mode, rideSessionId: selected.rideSessionId, upstreamAcknowledged: false}; attempts.push(observation);
        if (mode === 'drop-before') {request.socket.destroy(); return;}
        const result = await call('submitRating', parent, input.data);
        observation.upstreamAcknowledged = true;
        if (mode === 'drop-after') {request.socket.destroy(); return;}
        response.writeHead(200, {'content-type': 'application/json'}); response.end(JSON.stringify({result}));
      })().catch(() => {
        if (!response.destroyed && !response.headersSent) {response.writeHead(500); response.end('Isolated fault setup failed');}
      });
    });
    await new Promise(resolveListen => server.listen(0, '127.0.0.1', resolveListen));
    const send = async () => {
      const response = await fetch(`http://127.0.0.1:${server.address().port}/submitRating`, {
        method: 'POST', redirect: 'error', signal: AbortSignal.timeout(30_000),
        headers: {'content-type': 'application/json', authorization: 'Bearer ' + parent.token, connection: 'close'},
        body: JSON.stringify({data: selected}),
      });
      assert.equal(response.status, 200); return (await response.json()).result;
    };
    const saved = async id => (await db.collection('ratings').doc(id).get()).data();
    let storedBeforeRetry, storedId;
    try {
      await check('disconnect-before-forwarding-preserves-both-same-name-trip-contexts-without-a-rating', async () => {
        await assert.rejects(send, TypeError); assert.equal(attempts.length, 1); assert.equal(attempts[0].upstreamAcknowledged, false);
        assert.equal((await db.collection('ratings').get()).size, 0);
        const rows = (await collectPendingReviews(parent)).items;
        assert.equal(rows.find(row => row.rideSessionId === rides[0]).tripContext.departureLabel, '28 octobre 2026 à 18:45');
        assert.equal(rows.find(row => row.rideSessionId === rides[1]).tripContext.departureLabel, '29 octobre 2026 à 18:45');
      });
      await check('explicit-retry-after-before-commit-loss-removes-only-the-selected-trip', async () => {
        mode = 'pass'; const receipt = await send(); assert.equal((await saved(receipt.ratingId)).score, 5);
        assert.deepEqual((await collectPendingReviews(parent)).items.map(row => row.rideSessionId).sort(), [rides[0], rides[2]].sort());
      });
      await check('disconnect-after-real-commit-withholds-the-acknowledgement-without-automatic-retry', async () => {
        selected = {...selected, rideSessionId: rides[0]}; mode = 'drop-after';
        await assert.rejects(send, TypeError); assert.equal(attempts.length, 3); assert.equal(attempts[2].upstreamAcknowledged, true);
        storedId = `${rides[0]}_${parent.uid}_${driver.uid}`; storedBeforeRetry = await saved(storedId);
        assert.equal(storedBeforeRetry.score, 5); assert.equal((await db.collection('ratings').get()).size, 2);
      });
      await check('identical-explicit-retry-recovers-the-original-receipt-without-changing-count-or-timestamp', async () => {
        mode = 'pass'; assert.deepEqual(await send(), {ratingId: storedId});
        assert.deepEqual(await saved(storedId), storedBeforeRetry); assert.equal((await db.collection('ratings').get()).size, 2);
        assert.deepEqual((await collectPendingReviews(parent)).items.map(row => row.rideSessionId), [rides[2]]);
        assert.equal((await collectPendingReviews(driver)).items.length, 3);
      });
      await check('simultaneous-identical-submissions-return-one-immutable-rating', async () => {
        const input = {...selected, rideSessionId: rides[2]};
        const receipts = await Promise.all([call('submitRating', parent, input), call('submitRating', parent, input)]);
        assert.deepEqual(receipts[0], receipts[1]); assert.equal((await db.collection('ratings').get()).size, 3);
      });
      await check('retries-cannot-change-score-or-comment-on-a-stored-rating', async () => {
        await denied('submitRating', parent, {...selected, score: 4}, 'ALREADY_EXISTS');
        await denied('submitRating', parent, {...selected, comment: 'Changed'}, 'ALREADY_EXISTS');
        assert.deepEqual(await saved(storedId), storedBeforeRetry);
      });
      await check('replay-still-requires-current-authentication-completed-ride-and-participation', async () => {
        await denied('submitRating', null, selected, 'UNAUTHENTICATED');
        await denied('submitRating', manager, selected, 'PERMISSION_DENIED');
        await denied('submitRating', parent, {...selected, ratedUserId: parent.uid}, 'FAILED_PRECONDITION');
        const ref = db.collection('rideSessions').doc(rides[0]), original = prepared.get(ref.path);
        await ref.update({participantUserIds: []}); await denied('submitRating', parent, selected, 'PERMISSION_DENIED');
        await ref.set({...original, status: 'active'}); await denied('submitRating', parent, selected, 'FAILED_PRECONDITION');
        await ref.set(original); assert.deepEqual(await saved(storedId), storedBeforeRetry);
      });
      await check('all-unrelated-records-claims-and-trip-details-remain-unchanged', async () => {
        for (const [path, data] of [...originals, ...prepared]) assert.deepEqual((await db.doc(path).get()).data(), data, path);
        assert.deepEqual(await Promise.all(actors.map(async actor => (await auth.getUser(actor.uid)).customClaims)), claims);
        assert.equal((await db.collection('ratings').get()).size, 3); assert.equal(attempts.length, 4);
      });
      completed = true;
    } finally {await new Promise(resolveClose => {server.close(resolveClose); server.closeAllConnections();});}
  }, {firestore: {terminate: async () => {await db.terminate(); firestoreClientTerminated = true;}},
    closeApp: async app => {await deleteApp(app); adminClientClosed = true;}});
} catch (error) {failure = error;}
writeFileSync(process.env.SGM_LOCAL_FLOW_OUTPUT, JSON.stringify({projectId: 'demo-sgm-local-qa', runId: process.env.SGM_LOCAL_RUN_ID,
  testedAt: new Date().toISOString(), scope: 'loopback-http-review-disconnects-and-real-isolated-callables-not-phone-or-production',
  completed: completed && !failure, checks, attempts, protectedRecordCount, adminClientClosed, firestoreClientTerminated,
  productionWrites: false, phoneUiExecuted: false, physicalNetworkLossProven: false, providerRequests: 0,
  sourceFiles: Object.fromEntries(sources.map(file => [file, createHash('sha256').update(readFileSync(resolve(root, file))).digest('hex')]))},
null, 2) + '\n', {flag: 'wx', mode: 0o600});
if (failure) throw new Error('Review recovery failed; inspect the sanitized receipt.');

import './local-egress-guard.mjs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFileSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {getDatabase} from 'firebase-admin/database';
import {deleteApp} from 'firebase-admin/app';
import {auth, db, call, signIn, tripInput, viewedBooking} from './local-flow-client.mjs';
import {withLocalAdminCleanup} from './local-admin-lifecycle.mjs';
import {snapshotSessionRestorationRecords} from './session-restoration-records.mjs';
import {openBookingReceiptLossProxy} from './booking-receipt-loss-proxy.mjs';
import {verifyChildBookingReceiptRecords, verifyChildBookingReservation} from './child-booking-receipt-records.mjs';
import {bookingIntentRevision, bookingSnapshotRevision, bookingIntentSnapshotSchema} from '../../functions/lib/domain/bookingIntent.js';

const paths = ['scripts/qa/local-child-booking-receipt.mjs', 'scripts/qa/run-local-child-booking-receipt.mjs', 'scripts/qa/booking-receipt-target.mjs',
  'scripts/qa/booking-receipt-loss-proxy.mjs', 'scripts/qa/child-booking-receipt-records.mjs',
  'scripts/qa/session-restoration-records.mjs', 'functions/src/callables/bookingRequests.ts',
  'functions/src/domain/bookingRequestIdentity.ts', 'functions/src/domain/bookingIntent.ts', 'functions/src/callables/reservations.ts'];
const hashSources = () => Object.fromEntries(paths.map(path => [path,
  createHash('sha256').update(readFileSync(resolve(import.meta.dirname, '../..', path))).digest('hex')]));
const sourceFiles = hashSources();
const checks = [], states = {}, snapshots = async () => JSON.parse(JSON.stringify(await snapshotSessionRestorationRecords(db, auth, getDatabase())));
let proxy, baseline, target, input, original, bookingId, failure, adminClientClosed = false, firestoreClientTerminated = false;
const step = async (id, action) => {await action(); checks.push({id, status: 'passed'});};
try {
  await withLocalAdminCleanup(async () => {
    execFileSync(process.execPath, [resolve(import.meta.dirname, 'seed-firebase-emulator.mjs')],
      {env: process.env, stdio: ['ignore', 'pipe', 'pipe'], timeout: 90_000});
    const parent = await signIn('p@example.test'), driver = await signIn('d@example.test');
    for (const actor of [parent, driver]) await call('initializeUserProfile', actor);
    const {tripId} = await call('createTrip', driver, {...tripInput(), title: 'QA enfant reprise de réservation', priceCents: 0});
    const trip = (await db.doc('trips/' + tripId).get()).data();
    target = {subject: 'child-search-two-seats', tripId, childId: 'sgm-qa-child-lina', seats: 2, intentRevision: bookingIntentRevision(trip)};
    input = await viewedBooking(parent, {tripId, childId: target.childId, seats: 2}); baseline = await snapshots();
    proxy = await openBookingReceiptLossProxy({runId: process.env.SGM_LOCAL_RUN_ID, port: 0, upstreamPort: 5001,
      verifyIdentity: token => auth.verifyIdToken(token),
      verifyIntent: value => bookingSnapshotRevision(bookingIntentSnapshotSchema.parse(value)),
      afterCommit: async (id, clientRequestId) => {
        const state = await snapshots(), result = verifyChildBookingReceiptRecords(baseline, state, target, bookingId);
        assert.equal(result.bookingId, id); assert.equal(clientRequestId, input.clientRequestId);
        if (original) assert.deepEqual(state, original); else original = state;
        bookingId = id; return {...result, clientRequestId};
      }});
    proxy.arm(target);
    const send = async (method, actor, data) => {
      const response = await fetch(`http://127.0.0.1:${proxy.port}/demo-sgm-local-qa/us-central1/${method}`, {
        method: 'POST', headers: {'content-type': 'application/json', authorization: 'Bearer ' + actor.token, connection: 'close'},
        body: JSON.stringify({data}), signal: AbortSignal.timeout(20_000)});
      const body = await response.json(); assert.equal(response.status, 200); assert(!body.error); return body.result;
    };
    await step('real-child-booking-commits-before-first-reply-is-lost', async () => {
      await assert.rejects(() => send('requestBooking', parent, input), TypeError);
      assert.equal(proxy.receipt.failed, false); assert.equal(proxy.receipt.phase, 'lost'); assert(bookingId);
      assert.equal(proxy.receipt.attempts.length, 1); assert.equal(proxy.receipt.attempts[0].responseReleased, false);
      states.committed = await snapshots(); assert.deepEqual(states.committed, original);
    });
    await step('unconfirmed-repeat-is-blocked-without-forwarding-or-changing-records', async () => {
      await assert.rejects(() => send('requestBooking', parent, input), TypeError);
      assert.equal(proxy.receipt.attempts.length, 2); assert.equal(proxy.receipt.attempts[1].blockedBeforeForwarding, true);
      states.blocked = await snapshots(); assert.deepEqual(states.blocked, original);
    });
    await step('parent-history-retains-the-original-child-and-two-seats-before-confirmation', async () => {
      const page = await send('listReservations', parent, {role: 'parent'});
      verifyChildBookingReservation(page, target, bookingId);
      states.unconfirmedHistory = await snapshots(); assert.deepEqual(states.unconfirmedHistory, original);
    });
    await step('fresh-auth-session-reads-the-same-pending-child-booking-without-resubmission', async () => {
      const reconnected = await signIn('p@example.test'); assert.equal(reconnected.uid, parent.uid);
      const page = await send('listReservations', reconnected, {role: 'parent'});
      verifyChildBookingReservation(page, target, bookingId);
      states.reauthenticated = await snapshots(); assert.deepEqual(states.reauthenticated, original);
      assert.equal(proxy.receipt.attempts.filter(row => row.upstreamAcknowledged).length, 1);
    });
    await step('explicit-retry-returns-the-genuine-original-receipt', async () => {
      proxy.recover(); const result = await send('requestBooking', parent, input);
      assert.equal(result.bookingId, bookingId); assert.equal(result.clientRequestId, input.clientRequestId);
      assert.equal(result.reused, true); assert.equal(result.currentBookingStatus, 'requested');
      const attempts = proxy.receipt.attempts.filter(row => row.upstreamAcknowledged);
      assert.deepEqual(attempts.map(row => row.responseReleased), [false, true]); assert.deepEqual(attempts[0].commit, attempts[1].commit);
      assert.equal(attempts[0].requestSha256, attempts[1].requestSha256);
      states.retried = await snapshots(); assert.deepEqual(states.retried, original);
    });
    await step('foreign-parent-cannot-find-or-replay-the-child-booking', async () => {
      const foreign = await signIn('c@example.test');
      const page = await call('listReservations', foreign, {role: 'parent'}); assert(!page.items.some(row => row.bookingId === bookingId));
      await assert.rejects(() => call('requestBooking', foreign, input), error => error.code === 'PERMISSION_DENIED');
      states.foreign = await snapshots(); assert.deepEqual(states.foreign, original);
    });
    await step('original-timestamps-claims-unrelated-records-and-capacity-remain-unchanged', async () => {
      states.final = await snapshots(); assert.deepEqual(states.final, original);
      verifyChildBookingReceiptRecords(baseline, states.final, target, bookingId);
      assert.equal(proxy.receipt.failed, false);
    });
  }, {firestore: {terminate: async () => {await db.terminate(); firestoreClientTerminated = true;}},
    closeApp: async app => {await deleteApp(app); adminClientClosed = true;}});
} catch (error) {failure = error.name;}
finally {await proxy?.close();}
const sourceFilesUnchanged = JSON.stringify(sourceFiles) === JSON.stringify(hashSources());
if (!sourceFilesUnchanged) failure ??= 'SourceChanged';
writeFileSync(process.env.SGM_LOCAL_FLOW_OUTPUT, JSON.stringify({projectId: 'demo-sgm-local-qa', runId: process.env.SGM_LOCAL_RUN_ID,
  testedAt: new Date().toISOString(), scope: 'local-genuine-child-booking-receipt-loss-not-search-or-phone-process-restart',
  completed: !failure && checks.length === 7, failureKind: failure ?? null, checks, sourceFiles, sourceFilesUnchanged, target, input, baseline, states,
  proxy: proxy?.receipt, adminClientClosed, firestoreClientTerminated, physicalUiVerified: false, processRestartVerified: false,
  searchUiVerified: false, productionWrites: false, realPayments: false, mapRequests: 0, releaseComplete: false}, null, 2) + '\n', {flag: 'wx', mode: 0o600});
if (failure) throw new Error('Child booking service trial failed; preserve its original evidence without accepting phone recovery.');
console.log('Child booking receipt-loss service trial: 7 checks passed; no phone or search completion inferred.');

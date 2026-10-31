import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {existsSync, readFileSync, statSync, writeFileSync} from 'node:fs';
import {dirname, isAbsolute, resolve} from 'node:path';
import {createInterface} from 'node:readline';
import {getDatabase} from 'firebase-admin/database';
import {deleteApp} from 'firebase-admin/app';
import {openBookingReceiptLossProxy} from './booking-receipt-loss-proxy.mjs';
import {snapshotSessionRestorationRecords} from './session-restoration-records.mjs';
import {verifyDirectBookingCheckpoint, directBookingPhoneTripId} from './direct-booking-phone-checkpoints.mjs';
import {withLocalAdminCleanup} from './local-admin-lifecycle.mjs';
import {bookingReceiptPlan, assertBookingReceiptPhase} from './booking-receipt-checkpoint-plan.mjs';

const [handoffPath, appSessionPath, output, apk] = process.argv.slice(2);
assert([6, 7].includes(process.argv.length));
const plan = bookingReceiptPlan(process.argv[6]);
assert([handoffPath, appSessionPath, output, apk].every(path => isAbsolute(path ?? '')) && process.stdin.isTTY);
for (const path of [handoffPath, dirname(handoffPath), output]) assert.equal(statSync(path).mode & 0o077, 0);
assert(!existsSync(appSessionPath));
const handoff = JSON.parse(readFileSync(handoffPath)); assert.equal(handoff.projectId, 'demo-sgm-local-qa');
process.env.SGM_QA_PASSWORD = handoff.password; process.env.SGM_LOCAL_RUN_ID = handoff.runId;
process.env.SGM_LOCAL_UI_SESSION_FILE = appSessionPath;
const {auth, db} = await import('./local-flow-client.mjs');
const {seedLocalUiFixtures} = await import('./local-ui-fixtures.mjs');
const {bookingIntentRevision, bookingSnapshotRevision, bookingIntentSnapshotSchema} = await import('../../functions/lib/domain/bookingIntent.js');
const sources = ['scripts/qa/manual-booking-receipt-loss-session.mjs', 'scripts/qa/booking-receipt-loss-proxy.mjs',
  'scripts/qa/booking-receipt-checkpoint-plan.mjs',
  'scripts/qa/direct-booking-phone-checkpoints.mjs', 'scripts/qa/session-restoration-records.mjs', 'functions/src/domain/bookingIntent.ts'];
const hashSources = () => Object.fromEntries(sources.map(file => [file,
  createHash('sha256').update(readFileSync(resolve(import.meta.dirname, '../..', file))).digest('hex')]));
const sourceFiles = hashSources(), checks = [];
const phases = plan.phases;
const input = createInterface({input: process.stdin, terminal: false}), stop = () => input.close();
process.once('SIGINT', stop); process.once('SIGTERM', stop);
const save = (name, value) => writeFileSync(resolve(output, name + '.json'), JSON.stringify(value, null, 2) + '\n', {flag: 'wx', mode: 0o600});
const snapshot = async () => JSON.parse(JSON.stringify(await snapshotSessionRestorationRecords(db, auth, getDatabase())));
let proxy, baseline, firstCommittedState, bookingId, completed = false, failure, adminClientClosed = false, firestoreClientTerminated = false;
try {
  await withLocalAdminCleanup(async () => {
    proxy = await openBookingReceiptLossProxy({runId: handoff.runId, verifyIdentity: token => auth.verifyIdToken(token),
      verifyIntent: value => bookingSnapshotRevision(bookingIntentSnapshotSchema.parse(value)),
      afterCommit: async (id, clientRequestId) => {
        const state = await snapshot(), result = verifyDirectBookingCheckpoint('confirmed', baseline, state, bookingId);
        assert.equal(result.bookingId, id); if (bookingId) assert.deepEqual(state, firstCommittedState);
        bookingId = id; firstCommittedState ??= state;
        const receipt = state.documents.bookingRequestReceipts.find(row => row.data.response.bookingId === id);
        assert.equal(receipt.data.clientRequestId, clientRequestId);
        return {bookingId: id, clientRequestId, bookingCount: 1, receiptCount: 1, notificationCount: 1};
      }});
    const session = await seedLocalUiFixtures(); assert.equal(session.runId, handoff.runId);
    baseline = await snapshot(); save('baseline', {runId: handoff.runId, projectId: handoff.projectId, baseline});
    const trip = (await db.doc('trips/' + directBookingPhoneTripId).get()).data();
    proxy.arm({tripId: directBookingPhoneTripId, intentRevision: bookingIntentRevision(trip)});
    console.log('Isolated adult booking reply-loss trial ready. Only the phone may submit.');
    console.log(phases.join(', ') + ', finish. stop retains an incomplete trial.');
    for await (const line of input) {
      const phase = line.trim(); if (phase === 'stop') break;
      if (phase === 'finish') {assert.equal(checks.length, phases.length); completed = true; break;}
      assertBookingReceiptPhase(plan, phase, checks.length, proxy.receipt);
      const state = await snapshot(), committed = checks.length >= 2;
      const result = verifyDirectBookingCheckpoint(committed ? 'confirmed' : 'opened-no-write', baseline, state, bookingId);
      if (committed) {assert(bookingId); assert.deepEqual(state, firstCommittedState);}
      if (phase === plan.retryPhase) proxy.recover();
      const check = {runId: handoff.runId, phase, observedAt: new Date().toISOString(), status: 'passed', result, state,
        originalRecordsAndClaimsPreserved: true, committedFieldsAndTimestampsUnchanged: committed,
        proxy: structuredClone(proxy.receipt), phoneUiProvenByObserver: false};
      save(phase, check); checks.push(check); console.log('Independent booking reply-loss checkpoint passed: ' + phase);
    }
  }, {firestore: {terminate: async () => {await db.terminate(); firestoreClientTerminated = true;}},
    closeApp: async app => {await deleteApp(app); adminClientClosed = true;}});
} catch (error) {failure = error;}
finally {input.close(); await proxy?.close(); process.removeListener('SIGINT', stop); process.removeListener('SIGTERM', stop);
  delete process.env.SGM_QA_PASSWORD; delete process.env.SGM_LOCAL_RUN_ID; delete process.env.SGM_LOCAL_UI_SESSION_FILE;}
const sourceFilesUnchanged = JSON.stringify(sourceFiles) === JSON.stringify(hashSources());
if (!sourceFilesUnchanged) failure ??= Object.assign(new Error('Source changed'), {code: 'SOURCE_CHANGED'});
save('session-results', {runId: handoff.runId, projectId: handoff.projectId, scenario: plan.name, completed: completed && !failure, checks,
  failedCheckpoint: failure ? phases[checks.length] ?? 'finish' : null, failureKind: failure?.code ?? failure?.name ?? null,
  proxy: proxy?.receipt ?? null, sourceFiles, sourceFilesUnchanged, adminClientClosed, firestoreClientTerminated,
  fixtureSubmittedAdultBooking: false, controllerSubmittedBooking: false, phoneUiProvenByObserver: false,
  processRestartProvenByObserver: false, realWorldRadioLossProven: false, installedBytesIndependentlyVerified: false,
  sourceApkSha256: createHash('sha256').update(readFileSync(apk)).digest('hex'), productionWrites: false, realPayments: false, mapRequests: 0});
if (failure) throw new Error('Booking reply-loss trial failed; preserve its original observations.');

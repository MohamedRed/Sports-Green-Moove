import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {existsSync, mkdirSync, readFileSync, statSync, writeFileSync} from 'node:fs';
import {isAbsolute, resolve} from 'node:path';
import {createInterface} from 'node:readline';
import {normalizeCancellationProfiles, verifyCancellationWithCapacity} from './trip-cancellation-phone-checkpoints.mjs';
import {staleCancellationPhonePhases, verifyPeerApproval} from './cancellation-stale-phone-checkpoints.mjs';

const [path, output] = process.argv.slice(2);
assert(isAbsolute(path ?? '') && isAbsolute(output ?? '') && !existsSync(output) && process.stdin.isTTY);
assert.equal(statSync(path).mode & 0o077, 0);
const session = JSON.parse(readFileSync(path));
assert.equal(session.projectId, 'demo-sgm-local-qa'); assert.match(session.runId, /^[a-f0-9]{32}$/);
assert(typeof session.password === 'string' && session.password.length >= 12);
assert.equal(session.driver, 'd@example.test'); assert.equal(session.parent, 'p@example.test');
process.env.SGM_QA_PASSWORD = session.password;
const {auth, db, call, signIn} = await import('./local-flow-client.mjs');
const {seedCancellationPhoneFixture} = await import('./trip-cancellation-phone-fixture.mjs');
const {snapshotSessionRestorationRecords} = await import('./session-restoration-records.mjs');
const {withLocalAdminCleanup} = await import('./local-admin-lifecycle.mjs');
const {getDatabase} = await import('firebase-admin/database');
const {deleteApp} = await import('firebase-admin/app');
mkdirSync(output, {mode: 0o700});
const input = createInterface({input: process.stdin, terminal: false}), checkpoints = [];
const save = (name, value) => writeFileSync(resolve(output, name + '.json'), JSON.stringify(value, null, 2) + '\n', {mode: 0o600, flag: 'wx'});
const stop = () => input.close(); process.once('SIGINT', stop); process.once('SIGTERM', stop);
let fixture, reviewedFixture, baseline, approved, confirmed, completed = false, failure = null, phase = 'preparation';
let adminClientClosed = false, firestoreClientTerminated = false;
try {
  await withLocalAdminCleanup(async () => {
    fixture = await seedCancellationPhoneFixture();
    const snapshot = async () => JSON.parse(JSON.stringify(await snapshotSessionRestorationRecords(db, auth, getDatabase())));
    const same = (before, after) => assert.deepEqual(normalizeCancellationProfiles(after, fixture), normalizeCancellationProfiles(before, fixture));
    baseline = await snapshot(); save('baseline', {projectId: session.projectId, runId: session.runId, fixture, baseline});
    console.log('Isolated stale-preview trial prepared: ' + fixture.title + '.');
    console.log('Ordered commands: ' + staleCancellationPhonePhases.join(', ') + ', finish. Only peer-approved mutates data through a separate authenticated driver service.');
    for await (const line of input) {
      phase = line.trim(); if (phase === 'stop') break;
      if (phase === 'finish') {assert.equal(checkpoints.length, staleCancellationPhonePhases.length); completed = true; break;}
      assert.equal(phase, staleCancellationPhonePhases[checkpoints.length]);
      if (phase === 'peer-approved') {
        await call('approveBooking', await signIn(session.driver), {bookingId: fixture.pendingBookingId});
        approved = await snapshot(); save('observed-peer-approved', {state: approved, recordedAt: new Date().toISOString()});
        verifyPeerApproval(baseline, approved, fixture);
        const preview = await call('getTripCancellation', await signIn(session.driver), {tripId: fixture.tripId});
        assert.equal(preview.status, 'ready'); assert.equal(preview.bookingCount, 2);
        assert.notEqual(preview.revision, fixture.initialPreview.revision);
        reviewedFixture = {...fixture, initialPreview: preview}; same(approved, await snapshot());
        save('changed-preview', {original: fixture.initialPreview, reviewed: preview});
      }
      const state = await snapshot();
      save('observed-' + phase + '-checkpoint', {projectId: session.projectId, runId: session.runId, phase, state, recordedAt: new Date().toISOString()});
      let result;
      if (checkpoints.length < 2) {same(baseline, state); result = {phase, unchanged: true};}
      else if (checkpoints.length < 5) {same(approved, state); result = {phase, unchanged: true, cancellationReceipts: 0};}
      else {
        result = verifyCancellationWithCapacity('cancellation-confirmed', approved, state, reviewedFixture, 1);
        result.phase = phase;
        if (phase === 'cancellation-confirmed') confirmed = state; else same(confirmed, state);
      }
      save(phase, {projectId: session.projectId, runId: session.runId, phase, state, result, recordedAt: new Date().toISOString()});
      checkpoints.push(result); console.log('Independent stale-preview checkpoint passed: ' + phase);
    }
  }, {firestore: {terminate: async () => {await db.terminate(); firestoreClientTerminated = true;}},
    closeApp: async app => {await deleteApp(app); adminClientClosed = true;}});
} catch (error) {
  failure = {phase, type: error?.name === 'AssertionError' ? 'AssertionError' : 'PreparationOrReadFailure',
    operator: typeof error?.operator === 'string' ? error.operator : null}; save('failed-checkpoint', failure);
} finally {input.close(); process.removeListener('SIGINT', stop); process.removeListener('SIGTERM', stop); delete process.env.SGM_QA_PASSWORD;}
const paths = ['scripts/qa/manual-cancellation-stale-phone-session.mjs', 'scripts/qa/cancellation-stale-phone-checkpoints.mjs',
  'scripts/qa/trip-cancellation-phone-fixture.mjs', 'scripts/qa/trip-cancellation-phone-checkpoints.mjs',
  'scripts/qa/session-restoration-records.mjs', 'functions/src/callables/bookings.ts', 'functions/src/services/tripCancellation.ts',
  'android/app/src/main/java/be/sportgreenmoove/app/ui/TripCancellationState.kt', 'android/app/src/main/java/be/sportgreenmoove/app/ui/TripCancellationDialog.kt'];
save('session-results', {scope: 'independent-stale-preview-records-not-phone-ui-or-simultaneous-transaction-proof',
  projectId: session.projectId, runId: session.runId, testedAt: new Date().toISOString(), completed: completed && !failure,
  fixture, reviewedFixture, checkpoints, adminClientClosed, firestoreClientTerminated, failure,
  physicalUiProven: false, concurrentTransactionOverlapProven: false, phoneWireAbortedCodeProven: false,
  pushDeliveryVerified: false, productionWrites: false, realPaymentExercised: false, providerRequests: 0,
  sourceFiles: Object.fromEntries(paths.map(file => [file, createHash('sha256').update(readFileSync(resolve(import.meta.dirname, '../..', file))).digest('hex')]))});
if (failure) throw new Error('Stale-preview observer did not complete; preserve its original result.');
console.log('Observer closed; separately dispose of the phone, helper and owned runtime.');

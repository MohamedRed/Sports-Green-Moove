import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, statSync, writeFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { createInterface } from 'node:readline';

const [sessionPath, output] = process.argv.slice(2);
assert(isAbsolute(sessionPath ?? '') && isAbsolute(output ?? '') && process.stdin.isTTY);
assert.equal(statSync(sessionPath).mode & 0o077, 0);
const session = JSON.parse(readFileSync(sessionPath)); assert.equal(session.projectId, 'demo-sgm-local-qa');
process.env.SGM_QA_PASSWORD = session.password;
const {auth, db} = await import('./local-flow-client.mjs');
const {getDatabase} = await import('firebase-admin/database');
const {withLocalAdminCleanup} = await import('./local-admin-lifecycle.mjs');
const {assertSearchBookingCheckpoint} = await import('./search-booking-checkpoint.mjs');
const {readSearchBookingState} = await import('./search-booking-fixture.mjs');
const {snapshotSearchBookingRecords, verifySearchBookingIsolation} = await import('./search-booking-records.mjs');
const first = JSON.parse(readFileSync(resolve(output, 'baseline.json'))); assert.equal(first.runId, session.runId);
const phases = ['requested', 'approved', 'parent-returned', 'cancelled'], checkpoints = [];
const input = createInterface({input: process.stdin, terminal: false});
const stop = () => input.close(); process.once('SIGINT', stop); process.once('SIGTERM', stop);
let bookingId, completed = false, failure, isolation;
try {
  await withLocalAdminCleanup(async () => {
    console.log('Read-only phone observer ready: requested, approved, parent-returned, cancelled, finish.');
    for await (const command of input) {
      const phase = command.trim(); if (phase === 'stop') break;
      if (phase === 'finish') {
        assert.equal(checkpoints.length, phases.length);
        const after = JSON.parse(JSON.stringify(await snapshotSearchBookingRecords(db, auth, getDatabase())));
        isolation = verifySearchBookingIsolation(first.baseline, after, {tripId: first.fixture.tripId, bookingId});
        writeFileSync(resolve(output, 'final-state.json'), JSON.stringify(after, null, 2) + '\n', {flag: 'wx', mode: 0o600});
        completed = true; break;
      }
      assert.equal(phase, phases[checkpoints.length]);
      const bookings = await db.collection('bookings').where('tripId', '==', first.fixture.tripId).get();
      assert.equal(bookings.size, 1);
      if (bookingId) assert.equal(bookings.docs[0].id, bookingId); else bookingId = bookings.docs[0].id;
      const state = JSON.parse(JSON.stringify(await readSearchBookingState(first.fixture.tripId, bookingId)));
      const result = assertSearchBookingCheckpoint(phase === 'parent-returned' ? 'approved' : phase,
        state, {tripId: first.fixture.tripId, bookingId});
      writeFileSync(resolve(output, phase + '.json'), JSON.stringify({phase, result, state}, null, 2) + '\n', {flag: 'wx', mode: 0o600});
      checkpoints.push({phase, result}); console.log('Independent phone checkpoint passed: ' + phase);
    }
  }, {firestore: db});
} catch (error) {failure = error;}
finally {
  input.close(); process.removeListener('SIGINT', stop); process.removeListener('SIGTERM', stop); delete process.env.SGM_QA_PASSWORD;
}
const sources = ['scripts/qa/manual-search-booking-phone-session.mjs', 'scripts/qa/search-booking-phone-runtime.mjs',
  'scripts/qa/start-search-booking-phone.mjs', 'scripts/qa/search-booking-checkpoint.mjs', 'scripts/qa/search-booking-records.mjs',
  'scripts/qa/search-booking-fixture.mjs', 'scripts/qa/search-maps-fetch.mjs', 'scripts/qa/search-maps-policy.mjs'];
writeFileSync(resolve(output, 'phone-records.json'), JSON.stringify({projectId: session.projectId, runId: session.runId,
  recordedAt: new Date().toISOString(), scope: 'independent-search-booking-phone-records-not-ui-proof', completed: completed && !failure,
  checkpoints, isolation, bookingId, physicalUiProven: false, productionWrites: false, realPayment: false,
  sourceFiles: Object.fromEntries(sources.map(file => [file, createHash('sha256')
    .update(readFileSync(resolve(import.meta.dirname, '../..', file))).digest('hex')]))}, null, 2) + '\n', {flag: 'wx', mode: 0o600});
if (failure) throw new Error('Independent search-phone records failed; retain this attempt without retrying its provider allowance');
console.log('Independent search-phone observer closed. Dispose the phone, scoped helper and owned runtime separately.');

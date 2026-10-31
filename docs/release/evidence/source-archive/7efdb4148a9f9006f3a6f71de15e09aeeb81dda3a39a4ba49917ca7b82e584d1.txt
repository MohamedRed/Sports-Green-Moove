import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdirSync, readFileSync, statSync, writeFileSync} from 'node:fs';
import {isAbsolute, resolve} from 'node:path';
import {createInterface} from 'node:readline';
import {deleteApp} from 'firebase-admin/app';
import {getDatabase} from 'firebase-admin/database';
import {withLocalAdminCleanup} from './local-admin-lifecycle.mjs';
import {snapshotSessionRestorationRecords} from './session-restoration-records.mjs';
import {directBookingPhonePhases, directBookingPhoneTripId, verifyDirectBookingCheckpoint} from './direct-booking-phone-checkpoints.mjs';

const [path, output] = process.argv.slice(2);
assert(isAbsolute(path ?? '') && isAbsolute(output ?? '') && process.stdin.isTTY);
assert.equal(statSync(path).mode & 0o077, 0);
const {projectId, runId, password} = JSON.parse(readFileSync(path));
assert.equal(projectId, 'demo-sgm-local-qa'); assert.match(runId, /^[a-f0-9]{32}$/);
process.env.SGM_QA_PASSWORD = password;
const {auth, db} = await import('./local-flow-client.mjs');
mkdirSync(output, {mode: 0o700});
const save = (name, value) => writeFileSync(resolve(output, name + '.json'), JSON.stringify(value, null, 2) + '\n', {mode: 0o600, flag: 'wx'});
const input = createInterface({input: process.stdin, terminal: false}), checkpoints = [];
const stop = () => input.close(); process.once('SIGINT', stop); process.once('SIGTERM', stop);
let completed = false, bookingId, previous, failure, adminClientClosed = false, firestoreClientTerminated = false;
const snapshot = async () => JSON.parse(JSON.stringify(await snapshotSessionRestorationRecords(db, auth, getDatabase())));
try {
  await withLocalAdminCleanup(async () => {
    const baseline = await snapshot();
    assert((baseline.documents.trips ?? []).some(row => row.id === directBookingPhoneTripId && row.data.seatsAvailable >= 1));
    assert(!(baseline.documents.bookings ?? []).some(row => row.data.tripId === directBookingPhoneTripId &&
      row.data.parentUserId === 'sgm-qa-parent' && !row.data.childId && ['requested', 'approved'].includes(row.data.status)));
    save('baseline', {projectId, runId, baseline});
    console.log('Read-only direct-booking observer ready: ' + directBookingPhonePhases.join(', ') + ', finish.');
    for await (const line of input) {
      const phase = line.trim(); if (phase === 'stop') break;
      if (phase === 'finish') {assert.equal(checkpoints.length, directBookingPhonePhases.length); completed = true; break;}
      assert.equal(phase, directBookingPhonePhases[checkpoints.length]);
      const state = await snapshot(), result = verifyDirectBookingCheckpoint(phase, baseline, state, bookingId);
      if (bookingId) assert.deepEqual(state, previous, 'Reopening, force stop and account closure cannot change the acknowledged request');
      bookingId = result.bookingId ?? bookingId; previous = state;
      save(phase, {projectId, runId, recordedAt: new Date().toISOString(), phase, state, result});
      checkpoints.push(result); console.log('Independent direct-booking checkpoint passed: ' + phase);
    }
  }, {firestore: {terminate: async () => {await db.terminate(); firestoreClientTerminated = true;}},
    closeApp: async app => {await deleteApp(app); adminClientClosed = true;}});
} catch { failure = true; }
finally {input.close(); process.removeListener('SIGINT', stop); process.removeListener('SIGTERM', stop); delete process.env.SGM_QA_PASSWORD;}
const sources = ['scripts/qa/manual-direct-booking-phone-session.mjs', 'scripts/qa/direct-booking-phone-checkpoints.mjs',
  'scripts/qa/session-restoration-records.mjs', 'android/app/src/main/java/be/sportgreenmoove/app/ui/DirectBookingState.kt',
  'android/app/src/main/java/be/sportgreenmoove/app/ui/DirectBookingDialog.kt',
  'android/app/src/main/java/be/sportgreenmoove/app/ui/SportsGreenMooveRideActions.kt',
  'android/app/src/main/java/be/sportgreenmoove/app/ui/SportsGreenMooveApp.kt'];
save('session-results', {projectId, runId, testedAt: new Date().toISOString(), completed: completed && !failure,
  scope: 'independent-direct-booking-records-not-phone-ui-or-release-proof', checkpoints, adminClientClosed, firestoreClientTerminated,
  physicalUiProven: false, wholeProcessRestartProven: false, productionWrites: false, paymentExercised: false,
  sourceFiles: Object.fromEntries(sources.map(file => [file, createHash('sha256').update(readFileSync(resolve(import.meta.dirname, '../..', file))).digest('hex')]))});
if (failure) throw new Error('Direct-booking observer did not complete; preserve the original attempt.');
console.log('Observer closed; dispose the owned backend, phone and private helper separately.');

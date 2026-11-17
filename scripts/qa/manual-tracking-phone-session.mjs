import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {existsSync, mkdirSync, readFileSync, statSync, writeFileSync} from 'node:fs';
import {isAbsolute, resolve} from 'node:path';
import {createInterface} from 'node:readline';
import {trackingPhonePhases, trackingPhonePoints, verifyTrackingPhoneCheckpoint} from './tracking-phone-checkpoints.mjs';

const [sessionPath, output] = process.argv.slice(2);
assert(isAbsolute(sessionPath ?? '') && isAbsolute(output ?? '') && process.stdin.isTTY);
assert.equal(statSync(sessionPath).mode & 0o077, 0); assert(!existsSync(output));
const session = JSON.parse(readFileSync(sessionPath)); assert.equal(session.projectId, 'demo-sgm-local-qa');
assert.match(session.runId, /^[a-f0-9]{32}$/); process.env.SGM_QA_PASSWORD = session.password;
const {auth, db, call, signIn, tripInput, viewedBooking} = await import('./local-flow-client.mjs');
const {getDatabase} = await import('firebase-admin/database');
const {deleteApp} = await import('firebase-admin/app');
const {withLocalAdminCleanup} = await import('./local-admin-lifecycle.mjs');
const {snapshotSessionRestorationRecords} = await import('./session-restoration-records.mjs');
mkdirSync(output, {mode: 0o700});
const input = createInterface({input: process.stdin, terminal: false}), checkpoints = [];
const stop = () => input.close(); process.once('SIGINT', stop); process.once('SIGTERM', stop);
const save = (name, value) => writeFileSync(resolve(output, name), JSON.stringify(value, null, 2) + '\n', {mode: 0o600, flag: 'wx'});
let completed = false, failure, fixture, previous, signedOutAt, adminClientClosed = false, firestoreClientTerminated = false;
try {
  await withLocalAdminCleanup(async () => {
    const driver = await signIn(session.driver), parent = await signIn(session.parent);
    for (const actor of [driver, parent]) await call('initializeUserProfile', actor);
    const {tripId} = await call('createTrip', driver, {...tripInput(), title: 'Suivi GPS QA', priceCents: 0});
    const {bookingId} = await call('requestBooking', parent,
      await viewedBooking(parent, {tripId, childId: 'sgm-qa-child-lina', seats: 2}));
    await call('approveBooking', driver, {bookingId});
    fixture = {tripId, bookingId, driverUid: driver.uid, parentUid: parent.uid};
    const snapshot = () => snapshotSessionRestorationRecords(db, auth, getDatabase());
    const baseline = await snapshot(); save('baseline.json', {projectId: session.projectId, runId: session.runId, fixture, baseline});
    console.log('One free booked trip prepared. Only the phone may start and upload positions. Observer phases: ' + trackingPhonePhases.join(', ') + ', finish.');
    console.log('Simulated positions: ' + JSON.stringify(trackingPhonePoints));
    for await (const command of input) {
      const phase = command.trim(); if (phase === 'stop') break;
      if (phase === 'finish') {assert.equal(checkpoints.length, trackingPhonePhases.length); completed = true; break;}
      assert.equal(phase, trackingPhonePhases[checkpoints.length]);
      if (phase === 'signed-out-stable') assert(performance.now() - signedOutAt >= 50_000, 'Observe at least three 15-second intervals after sign-out');
      const state = await snapshot(), result = verifyTrackingPhoneCheckpoint(phase, state, baseline, fixture, previous);
      save(phase + '.json', {projectId: session.projectId, runId: session.runId, recordedAt: new Date().toISOString(), state, result,
        ...(phase === 'signed-out-stable' ? {observedSinceSignOutMs: performance.now() - signedOutAt} : {})});
      checkpoints.push(result); previous = state; if (phase === 'signed-out') signedOutAt = performance.now();
      console.log('Independent tracking checkpoint passed: ' + phase);
    }
  }, {firestore: {terminate: async () => {await db.terminate(); firestoreClientTerminated = true;}},
    closeApp: async app => {await deleteApp(app); adminClientClosed = true;}});
} catch (error) {failure = error;}
finally {input.close(); process.removeListener('SIGINT', stop); process.removeListener('SIGTERM', stop); delete process.env.SGM_QA_PASSWORD;}
const sources = ['manual-tracking-phone-session.mjs', 'tracking-phone-checkpoints.mjs', 'session-restoration-records.mjs'];
save('session-results.json', {scope: 'independent-simulated-gps-record-checkpoints-not-phone-ui-proof',
  projectId: session.projectId, runId: session.runId, testedAt: new Date().toISOString(), completed: completed && !failure,
  fixture, checkpoints, adminClientClosed, firestoreClientTerminated, phoneUiProven: false,
  realMovementProven: false, childTrackingProven: false, productionWrites: false, routeProviderRequests: 0,
  sourceFiles: Object.fromEntries(sources.map(file => ['scripts/qa/' + file,
    createHash('sha256').update(readFileSync(resolve(import.meta.dirname, file))).digest('hex')]))});
if (failure) throw new Error(String(failure.message).replaceAll(session.password, '[REDACTED]'));
console.log('Observer closed. Independently dispose of the owned phone, helper and local backend.');

import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {existsSync, mkdirSync, readFileSync, statSync, writeFileSync} from 'node:fs';
import {isAbsolute, resolve} from 'node:path';
import {createInterface} from 'node:readline';
import {cancellationPhonePhases, verifyCancellationPhoneCheckpoint} from './trip-cancellation-phone-checkpoints.mjs';

const [path, output] = process.argv.slice(2);
assert(isAbsolute(path ?? '') && isAbsolute(output ?? '') && !existsSync(output) && process.stdin.isTTY);
assert.equal(statSync(path).mode & 0o077, 0);
const session = JSON.parse(readFileSync(path));
assert.equal(session.projectId, 'demo-sgm-local-qa'); assert.match(session.runId, /^[a-f0-9]{32}$/);
assert(typeof session.password === 'string' && session.password.length >= 12);
assert.equal(session.driver, 'd@example.test'); assert.equal(session.parent, 'p@example.test');
process.env.SGM_QA_PASSWORD = session.password;
const {auth, db} = await import('./local-flow-client.mjs');
const {seedCancellationPhoneFixture} = await import('./trip-cancellation-phone-fixture.mjs');
const {snapshotSessionRestorationRecords} = await import('./session-restoration-records.mjs');
const {withLocalAdminCleanup} = await import('./local-admin-lifecycle.mjs');
const {getDatabase} = await import('firebase-admin/database');
const {deleteApp} = await import('firebase-admin/app');
mkdirSync(output, {mode: 0o700});
const input = createInterface({input: process.stdin, terminal: false}), checkpoints = [];
const save = (name, value) => writeFileSync(resolve(output, name + '.json'), JSON.stringify(value, null, 2) + '\n', {mode: 0o600, flag: 'wx'});
const stop = () => input.close(); process.once('SIGINT', stop); process.once('SIGTERM', stop);
let fixture, completed = false, failure = null, phase = 'preparation', adminClientClosed = false, firestoreClientTerminated = false;
try {
  await withLocalAdminCleanup(async () => {
    fixture = await seedCancellationPhoneFixture();
    const snapshot = async () => JSON.parse(JSON.stringify(await snapshotSessionRestorationRecords(db, auth, getDatabase())));
    const baseline = await snapshot(); save('baseline', {projectId: session.projectId, runId: session.runId, fixture, baseline});
    console.log('Isolated free trip prepared: approved child booking, second-parent pending request, older closed booking.');
    console.log('Read-only observer order: ' + cancellationPhonePhases.join(', ') + ', finish.');
    console.log('Second synthetic parent: ' + fixture.secondParentEmail);
    for await (const line of input) {
      phase = line.trim(); if (phase === 'stop') break;
      if (phase === 'finish') {assert.equal(checkpoints.length, cancellationPhonePhases.length); completed = true; break;}
      assert.equal(phase, cancellationPhonePhases[checkpoints.length]);
      const state = await snapshot();
      save('observed-' + phase, {projectId: session.projectId, runId: session.runId, phase, state, recordedAt: new Date().toISOString()});
      const result = verifyCancellationPhoneCheckpoint(phase, baseline, state, fixture);
      save(phase, {projectId: session.projectId, runId: session.runId, recordedAt: new Date().toISOString(), result, state});
      checkpoints.push(result); console.log('Independent cancellation checkpoint passed: ' + phase);
    }
  }, {firestore: {terminate: async () => {await db.terminate(); firestoreClientTerminated = true;}},
    closeApp: async app => {await deleteApp(app); adminClientClosed = true;}});
} catch (error) {
  failure = {phase, type: error?.name === 'AssertionError' ? 'AssertionError' : 'PreparationOrReadFailure',
    operator: typeof error?.operator === 'string' ? error.operator : null};
  save('failed-checkpoint', failure);
}
finally {input.close(); process.removeListener('SIGINT', stop); process.removeListener('SIGTERM', stop); delete process.env.SGM_QA_PASSWORD;}
const paths = ['scripts/qa/manual-trip-cancellation-phone-session.mjs', 'scripts/qa/trip-cancellation-phone-fixture.mjs',
  'scripts/qa/trip-cancellation-phone-checkpoints.mjs', 'scripts/qa/session-restoration-records.mjs',
  'android/app/src/main/java/be/sportgreenmoove/app/ui/TripCancellationState.kt',
  'android/app/src/main/java/be/sportgreenmoove/app/ui/TripCancellationDialog.kt',
  'android/app/src/main/java/be/sportgreenmoove/app/ui/TripsRoute.kt', 'functions/src/services/tripCancellation.ts'];
save('session-results', {scope: 'independent-whole-trip-cancellation-records-not-phone-ui-or-race-proof',
  projectId: session.projectId, runId: session.runId, testedAt: new Date().toISOString(), completed: completed && !failure,
  fixture, checkpoints, adminClientClosed, firestoreClientTerminated, physicalUiProven: false,
  failure,
  wholeProcessRestartProven: false, concurrentRaceProven: false, pushDeliveryVerified: false,
  productionWrites: false, realPaymentExercised: false, providerRequests: 0,
  sourceFiles: Object.fromEntries(paths.map(file => [file, createHash('sha256').update(readFileSync(resolve(import.meta.dirname, '../..', file))).digest('hex')]))});
if (failure) throw new Error('Cancellation observer did not complete; preserve its original result.');
console.log('Observer closed; independently dispose of the phone, private helper and owned runtime.');

import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {existsSync, mkdirSync, readFileSync, statSync, writeFileSync} from 'node:fs';
import {dirname, isAbsolute, resolve} from 'node:path';
import {createInterface} from 'node:readline';
import {verifyChatNetworkPhoneCheckpoint} from './chat-network-phone-checkpoints.mjs';
import {snapshotSessionRestorationRecords} from './session-restoration-records.mjs';
import {withLocalAdminCleanup} from './local-admin-lifecycle.mjs';

const [path, output] = process.argv.slice(2);
assert.equal(process.argv.length, 4);
assert(isAbsolute(path ?? '') && isAbsolute(output ?? '') && !existsSync(output) && process.stdin.isTTY);
for (const file of [path, dirname(path)]) assert.equal(statSync(file).mode & 0o077, 0);
const session = JSON.parse(readFileSync(path));
assert.equal(session.projectId, 'demo-sgm-local-qa'); assert.match(session.runId, /^[a-f0-9]{32}$/);
process.env.SGM_QA_PASSWORD = session.password;
const {auth, call, db, signIn, tripInput, viewedBooking} = await import('./local-flow-client.mjs');
const {getDatabase} = await import('firebase-admin/database');
const {deleteApp} = await import('firebase-admin/app');
mkdirSync(output, {mode: 0o700});
const save = (name, value) => writeFileSync(resolve(output, name + '.json'), JSON.stringify(value, null, 2) + '\n', {flag: 'wx', mode: 0o600});
const phases = ['ready', 'conversation-open', 'draft-visible', 'conversation-reopened', 'process-stopped', 'process-reopened', 'signed-out'];
const checkpoints = [], input = createInterface({input: process.stdin, terminal: false});
const stop = () => input.close(); process.once('SIGINT', stop); process.once('SIGTERM', stop);
let completed = false, failed = false, fixture, adminClientClosed = false, firestoreClientTerminated = false;
try {
  await withLocalAdminCleanup(async () => {
    const parent = await signIn(session.parent), driver = await signIn(session.driver);
    await call('initializeUserProfile', parent);
    const {tripId} = await call('createTrip', driver, {...tripInput(), title: 'Trajet brouillon privé QA'});
    const {bookingId} = await call('requestBooking', parent, await viewedBooking(parent, {tripId, seats: 1}));
    await call('approveBooking', driver, {bookingId});
    fixture = {tripId, bookingId, parentUid: parent.uid, driverUid: driver.uid};
    const baseline = await snapshotSessionRestorationRecords(db, auth, getDatabase());
    save('baseline', {projectId: session.projectId, runId: session.runId, fixture, state: baseline});
    console.log('Independent unsent-chat observer ready: ' + phases.join(', ') + ', finish; stop retains an incomplete trial.');
    for await (const line of input) {
      const phase = line.trim(); if (phase === 'stop') break;
      if (phase === 'finish') {assert.equal(checkpoints.length, phases.length); completed = true; break;}
      assert.equal(phase, phases[checkpoints.length]);
      const state = await snapshotSessionRestorationRecords(db, auth, getDatabase());
      const check = verifyChatNetworkPhoneCheckpoint('ready', baseline, state, fixture);
      const checkpoint = {phase, observedAt: new Date().toISOString(), zeroMessages: check.messageCount === 0,
        zeroNotifications: check.notificationCount === 0, protectedRecordsUnchanged: true, phoneUiProvenByObserver: false};
      save(phase, {projectId: session.projectId, runId: session.runId, checkpoint, state});
      checkpoints.push(checkpoint); console.log('Independent unsent-chat checkpoint passed: ' + phase);
    }
  }, {firestore: {terminate: async () => {await db.terminate(); firestoreClientTerminated = true;}},
    closeApp: async app => {await deleteApp(app); adminClientClosed = true;}});
} catch {failed = true;}
finally {input.close(); process.removeListener('SIGINT', stop); process.removeListener('SIGTERM', stop); delete process.env.SGM_QA_PASSWORD;}
const sources = ['scripts/qa/manual-chat-draft-phone.mjs', 'scripts/qa/chat-network-phone-checkpoints.mjs',
  'scripts/qa/session-restoration-records.mjs', 'android/app/src/main/java/be/sportgreenmoove/app/ui/ConversationRoute.kt',
  'android/app/src/main/java/be/sportgreenmoove/app/ui/ConversationComposerState.kt'];
save('results', {projectId: session.projectId, runId: session.runId, observedAt: new Date().toISOString(), fixture,
  scope: 'independent-unsent-chat-records-not-keyboard-or-draft-restoration-proof', completed: completed && !failed,
  failed, checkpoints, adminClientClosed, firestoreClientTerminated, productionWrites: false, mapRequests: 0,
  realPayments: false, phoneUiProvenByObserver: false, processRestartProvenByObserver: false,
  sourceFiles: Object.fromEntries(sources.map(file => [file, createHash('sha256').update(readFileSync(resolve(import.meta.dirname, '../..', file))).digest('hex')]))});
if (failed) throw new Error('Unsent-chat observer failed; retain the original incomplete attempt.');

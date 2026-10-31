import assert from 'node:assert/strict';
import {createHash, randomUUID} from 'node:crypto';
import {existsSync, mkdirSync, readFileSync, statSync, writeFileSync} from 'node:fs';
import {dirname, isAbsolute, resolve} from 'node:path';
import {createInterface} from 'node:readline';
import {chatNetworkPhoneBodies, chatNetworkPhonePhases, verifyChatNetworkPhoneCheckpoint} from './chat-network-phone-checkpoints.mjs';
import {snapshotSessionRestorationRecords} from './session-restoration-records.mjs';

const [path, output] = process.argv.slice(2);
assert.equal(process.argv.length, 4); assert(isAbsolute(path ?? '') && isAbsolute(output ?? '') && !existsSync(output));
assert(process.stdin.isTTY); assert.equal(statSync(path).mode & 0o077, 0); assert.equal(statSync(dirname(path)).mode & 0o077, 0);
const session = JSON.parse(readFileSync(path)); assert.equal(session.projectId, 'demo-sgm-local-qa');
assert.match(session.runId, /^[a-f0-9]{32}$/); process.env.SGM_QA_PASSWORD = session.password;
const {auth, call, db, signIn, tripInput, viewedBooking} = await import('./local-flow-client.mjs');
const {getDatabase} = await import('firebase-admin/database');
const {deleteApp} = await import('firebase-admin/app');
const {withLocalAdminCleanup} = await import('./local-admin-lifecycle.mjs');
mkdirSync(output, {mode: 0o700});
const save = (file, value) => writeFileSync(resolve(output, file + '.json'), JSON.stringify(value, null, 2) + '\n', {flag: 'wx', mode: 0o600});
const input = createInterface({input: process.stdin, terminal: false}), checkpoints = [];
const stop = () => input.close(); process.once('SIGINT', stop); process.once('SIGTERM', stop);
let fixture, completed = false, failed = false, adminClientClosed = false, firestoreClientTerminated = false;
try {
  await withLocalAdminCleanup(async () => {
    const parent = await signIn(session.parent), driver = await signIn(session.driver);
    await call('initializeUserProfile', parent);
    const {tripId} = await call('createTrip', driver, {...tripInput(), title: 'Trajet reprise réseau QA'});
    const {bookingId} = await call('requestBooking', parent, await viewedBooking(parent, {tripId, seats: 1}));
    await call('approveBooking', driver, {bookingId});
    fixture = {tripId, bookingId, parentUid: parent.uid, driverUid: driver.uid, replyRequestId: randomUUID()};
    save('fixture', {projectId: session.projectId, runId: session.runId, fixture,
      fixtureSubmittedChatMessages: 0, fixtureMethod: 'isolated-sdk-booking-not-phone-booking-proof'});
    const baseline = await snapshotSessionRestorationRecords(db, auth, getDatabase());
    verifyChatNetworkPhoneCheckpoint('ready', baseline, baseline, fixture); save('baseline', baseline);
    console.log('Independent chat observer ready: ' + chatNetworkPhonePhases.join(', ') + ', finish.');
    for await (const command of input) {
      const phase = command.trim(); if (phase === 'stop') break;
      if (phase === 'finish') {assert.equal(checkpoints.length, chatNetworkPhonePhases.length); completed = true; break;}
      assert.equal(phase, chatNetworkPhonePhases[checkpoints.length]);
      if (phase === 'reply-sent') {
        verifyChatNetworkPhoneCheckpoint('parent-sent', baseline, await snapshotSessionRestorationRecords(db, auth, getDatabase()), fixture);
        await call('sendChatMessage', driver, {bookingId, body: chatNetworkPhoneBodies.driver, clientMessageId: fixture.replyRequestId});
      }
      const state = await snapshotSessionRestorationRecords(db, auth, getDatabase());
      const check = verifyChatNetworkPhoneCheckpoint(phase, baseline, state, fixture);
      save(phase, {projectId: session.projectId, runId: session.runId, observedAt: new Date().toISOString(), state, check});
      checkpoints.push(check); console.log('Independent chat checkpoint passed: ' + phase);
    }
  }, {firestore: {terminate: async () => {await db.terminate(); firestoreClientTerminated = true;}},
    closeApp: async app => {await deleteApp(app); adminClientClosed = true;}});
} catch {failed = true;}
finally {input.close(); process.removeListener('SIGINT', stop); process.removeListener('SIGTERM', stop); delete process.env.SGM_QA_PASSWORD;}
const paths = ['scripts/qa/manual-chat-network-phone.mjs', 'scripts/qa/chat-network-phone-checkpoints.mjs',
  'scripts/qa/session-restoration-records.mjs', 'functions/src/callables/messages.ts', 'functions/src/callables/chatRead.ts'];
save('results', {projectId: session.projectId, runId: session.runId, observedAt: new Date().toISOString(), fixture,
  scope: 'independent-chat-records-with-sdk-driver-reply-not-phone-ui-radio-loss-or-peer-device',
  completed: completed && !failed, failed, checkpoints, adminClientClosed, firestoreClientTerminated,
  controllerSubmittedParentMessages: false, controllerSubmittedDriverReply: checkpoints.some(row => row.phase === 'reply-sent'),
  productionWrites: false, mapRequests: 0, realPaymentsExercised: false, phoneUiProvenByObserver: false,
  physicalRadioLossProvenByObserver: false, sourceFiles: Object.fromEntries(paths.map(file => [file,
    createHash('sha256').update(readFileSync(resolve(import.meta.dirname, '../..', file))).digest('hex')]))});
if (failed) throw new Error('Chat observer failed; keep the original trial incomplete.');

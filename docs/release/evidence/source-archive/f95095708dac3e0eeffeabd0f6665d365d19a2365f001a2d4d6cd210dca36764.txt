import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {existsSync, readFileSync, statSync, writeFileSync} from 'node:fs';
import {dirname, isAbsolute, resolve} from 'node:path';
import {createInterface} from 'node:readline';
import {openChatReceiptLossProxy} from './chat-receipt-loss-proxy.mjs';
import {chatReceiptLossPhases, normalizeChatReceiptProfile, verifyChatReceiptLossCheckpoint} from './chat-receipt-loss-checkpoints.mjs';
import {verifyChatNetworkPhoneCheckpoint} from './chat-network-phone-checkpoints.mjs';
import {snapshotSessionRestorationRecords} from './session-restoration-records.mjs';

const [handoffPath, appSessionPath, output, apk] = process.argv.slice(2);
assert.equal(process.argv.length, 6);
assert([handoffPath, appSessionPath, output, apk].every(path => isAbsolute(path ?? '')) && process.stdin.isTTY);
assert.equal(statSync(handoffPath).mode & 0o077, 0); assert.equal(statSync(dirname(handoffPath)).mode & 0o077, 0);
assert.equal(statSync(output).mode & 0o077, 0); assert(!existsSync(appSessionPath));
const handoff = JSON.parse(readFileSync(handoffPath)); assert.equal(handoff.projectId, 'demo-sgm-local-qa');
assert.match(handoff.runId, /^[a-f0-9]{32}$/);
process.env.SGM_QA_PASSWORD = handoff.password; process.env.SGM_LOCAL_RUN_ID = handoff.runId;
process.env.SGM_LOCAL_UI_SESSION_FILE = appSessionPath;
const {auth, db, signIn, call, tripInput, viewedBooking} = await import('./local-flow-client.mjs');
const {seedLocalUiFixtures} = await import('./local-ui-fixtures.mjs');
const {withLocalAdminCleanup} = await import('./local-admin-lifecycle.mjs');
const {deleteApp} = await import('firebase-admin/app');
const {getDatabase} = await import('firebase-admin/database');
const files = ['scripts/qa/manual-chat-receipt-loss-session.mjs', 'scripts/qa/chat-receipt-loss-proxy.mjs',
  'scripts/qa/chat-receipt-loss-checkpoints.mjs', 'scripts/qa/chat-network-phone-checkpoints.mjs',
  'scripts/qa/session-restoration-records.mjs', 'functions/src/callables/messages.ts', 'functions/src/callables/chatRead.ts'];
const hashSources = () => Object.fromEntries(files.map(file => [file,
  createHash('sha256').update(readFileSync(resolve(import.meta.dirname, '../..', file))).digest('hex')]));
const sourceFiles = hashSources(), checks = [], input = createInterface({input: process.stdin, terminal: false});
const stop = () => input.close(); process.once('SIGINT', stop); process.once('SIGTERM', stop);
let proxy, fixture, baseline, originalMessage, completed = false, failure, adminClientClosed = false, firestoreClientTerminated = false;
const save = (name, value) => writeFileSync(resolve(output, name + '.json'), JSON.stringify(value, null, 2) + '\n', {mode: 0o600, flag: 'wx'});
const snapshot = () => snapshotSessionRestorationRecords(db, auth, getDatabase());
try {
  await withLocalAdminCleanup(async () => {
    proxy = await openChatReceiptLossProxy({runId: handoff.runId, verifyIdentity: token => auth.verifyIdToken(token),
      verifyCommit: async (messageId, intent) => {
        assert(fixture && baseline);
        const state = await snapshot();
        verifyChatNetworkPhoneCheckpoint('parent-sent', normalizeChatReceiptProfile(baseline, baseline, fixture),
          normalizeChatReceiptProfile(state, baseline, fixture), fixture);
        const message = state.documents.messages.find(row => row.id === messageId); assert(message);
        assert.equal(message.data.clientMessageId, intent.clientMessageId);
        assert(Number.isFinite(message.data.createdAt?.toMillis()));
        if (originalMessage) {
          const {readByUserIds, ...data} = message.data, {readByUserIds: beforeRead, ...before} = originalMessage.data;
          assert.deepEqual(data, before, 'Retry must preserve the original server commit');
        } else {originalMessage = message; save('original-commit', {message, state});}
        return {messageId, originalRecordPreserved: true, messageCount: 1, notificationCount: 1};
      }});
    const session = await seedLocalUiFixtures(); assert.equal(session.runId, handoff.runId);
    const parent = await signIn(session.parent), driver = await signIn(session.driver);
    await call('initializeUserProfile', parent); await call('initializeUserProfile', driver);
    const {tripId} = await call('createTrip', driver, {...tripInput(), title: 'Confirmation message QA'});
    const {bookingId} = await call('requestBooking', parent, await viewedBooking(parent, {tripId, seats: 1}));
    await call('approveBooking', driver, {bookingId});
    fixture = {tripId, bookingId, parentUid: parent.uid, driverUid: driver.uid};
    baseline = await snapshot(); proxy.arm({bookingId});
    save('fixture', {runId: handoff.runId, fixture, fixtureSubmittedChatMessages: 0}); save('baseline', baseline);
    console.log('Chat receipt-loss fixture ready. Only the phone may send the message.');
    console.log('Observe ' + chatReceiptLossPhases.join(', ') + ', then finish. stop retains a partial attempt.');
    for await (const raw of input) {
      const phase = raw.trim(); if (phase === 'stop') break;
      if (phase === 'finish') {assert.equal(checks.length, chatReceiptLossPhases.length); completed = true; break;}
      assert.equal(phase, chatReceiptLossPhases[checks.length]);
      const state = await snapshot();
      const check = verifyChatReceiptLossCheckpoint(phase, baseline, state, fixture, proxy.receipt, originalMessage);
      save(phase, {observedAt: new Date().toISOString(), check, state, proxy: structuredClone(proxy.receipt)}); checks.push(check);
      if (phase === 'recovery-ready') proxy.recover();
      console.log('Independent chat receipt-loss checkpoint passed: ' + phase);
    }
  }, {firestore: {terminate: async () => {await db.terminate(); firestoreClientTerminated = true;}},
    closeApp: async app => {await deleteApp(app); adminClientClosed = true;}});
} catch (error) {failure = error;}
finally {
  input.close(); await proxy?.close(); process.removeListener('SIGINT', stop); process.removeListener('SIGTERM', stop);
  delete process.env.SGM_QA_PASSWORD; delete process.env.SGM_LOCAL_UI_SESSION_FILE; delete process.env.SGM_LOCAL_RUN_ID;
}
const sourceFilesUnchanged = JSON.stringify(sourceFiles) === JSON.stringify(hashSources());
if (!sourceFilesUnchanged) failure ??= Object.assign(new Error('Controller source changed'), {code: 'SOURCE_CHANGED'});
save('session-results', {runId: handoff.runId, projectId: handoff.projectId, completed: completed && !failure, checks,
  failedCheckpoint: failure ? chatReceiptLossPhases[checks.length] ?? 'finish' : null,
  failureKind: failure?.code ?? failure?.name ?? null, proxy: proxy?.receipt ?? null,
  adminClientClosed, firestoreClientTerminated, fixtureSubmittedChatMessages: 0, controllerSubmittedChatMessages: false,
  phoneUiProvenByObserver: false, physicalRadioLossProvenByObserver: false, installedBytesIndependentlyVerified: false,
  productionWrites: false, mapRequests: 0, realPayments: false,
  sourceApkSha256: createHash('sha256').update(readFileSync(apk)).digest('hex'), sourceFiles, sourceFilesUnchanged});
if (failure) throw new Error('Chat receipt-loss trial failed; retain its original observations.');

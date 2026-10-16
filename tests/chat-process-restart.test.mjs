import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertChatRestartReceipt } from '../scripts/qa/chat-restart-evidence.mjs';
import { assertChatNetworkReceipt, assertCellularRequestSetup } from '../scripts/qa/chat-network-evidence.mjs';
import { assertInstrumentationPassed } from '../scripts/qa/android-instrumentation-result.mjs';
import { stopDisposableChatProcess } from '../scripts/qa/local-chat-process-stop.mjs';
import { content, captures } from '../partner-portal/content.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const runId = 'a'.repeat(32), appId = 'be.sportgreenmoove.app.local';
function receipt() {
  const before = { projectId: 'demo-sgm-local-qa', runId, scope: 'native-ui-confirmed-conversation-restart-stage',
    stage: 'before', completed: true, actorUserId: 'sgm-qa-parent', processId: 101, firstMessageConfirmed: true };
  const stopped = { projectId: before.projectId, runId, scope: 'disposable-local-app-force-stop',
    appId, preparedProcessId: 101, observedBeforePid: 101, forceStopIssued: true, noProcessAfterStop: true };
  const after = { ...before, stage: 'after', processId: 202, sessionRestoredWithoutLogin: true,
    confirmedHistoryRestored: true, newSendConfirmed: true, driverReplyReceived: true, bothInboxesRead: true };
  return [before, stopped, after];
}

test('restart evidence requires complete, same-run app stages and an independently stopped different process', () => {
  assertChatRestartReceipt(...receipt(), runId);
  const exited = receipt(); exited[1].observedBeforePid = null;
  assertChatRestartReceipt(...exited, runId);
  for (const mutate of [
    (r) => { r[0].completed = false; }, (r) => { r[0].firstMessageConfirmed = false; },
    (r) => { r[1].appId = 'be.sportgreenmoove.app'; }, (r) => { r[1].runId = 'b'.repeat(32); },
    (r) => { r[1].forceStopIssued = false; }, (r) => { r[1].noProcessAfterStop = false; },
    (r) => { r[1].preparedProcessId = 999; }, (r) => { r[1].observedBeforePid = 999; },
    (r) => { r[2].processId = r[0].processId; }, (r) => { r[2].processId = 0; },
    (r) => { r[2].actorUserId = 'sgm-qa-driver'; }, (r) => { r[2].stage = 'before'; },
    (r) => { r[2].sessionRestoredWithoutLogin = false; }, (r) => { r[2].confirmedHistoryRestored = false; },
    (r) => { r[2].newSendConfirmed = false; }, (r) => { r[2].driverReplyReceived = false; },
    (r) => { r[2].bothInboxesRead = false; },
  ]) { const r = receipt(); mutate(r); assert.throws(() => assertChatRestartReceipt(...r, runId)); }
});

function device(overrides = {}) {
  const calls = [], writes = [];
  const states = [{ status: 0, stdout: '101\n', stderr: '' }, { status: 1, stdout: '', stderr: '' }];
  const session = { projectId: 'demo-sgm-local-qa', runId, disposableEmulator: true, password: 'private-do-not-log' };
  return { calls, writes, execute: (adb, args, options) => {
    assert.equal(adb, '/sdk/adb'); assert.equal(options.timeout, 30_000); calls.push(args);
    if (args.includes('get-state')) return 'device';
    if (args.includes('getprop')) return overrides.qemu ?? '1';
    if (args.includes('run-as')) return overrides.session ?? JSON.stringify(session);
    if (args.includes('cat')) return overrides.before ?? JSON.stringify(receipt()[0]);
    return '';
  }, spawn: (adb, args, options) => {
    assert.equal(options.timeout, 30_000); assert.equal(adb, '/sdk/adb');
    assert.deepEqual(args, ['-s', 'emulator-5554', 'shell', 'pidof', appId]);
    return overrides.pid ?? states.shift();
  }, write: (...args) => writes.push(args) };
}

test('force-stop is restricted to the current isolated app/session and never clears data or touches a real package', () => {
  const inherited = process.env.SGM_LOCAL_DISPOSABLE_EMULATOR;
  const run = (mock, serial = 'emulator-5554') => stopDisposableChatProcess('/sdk/adb', serial, runId, '/tmp/evidence', mock);
  try {
    delete process.env.SGM_LOCAL_DISPOSABLE_EMULATOR;
    const unapproved = device(); assert.throws(() => run(unapproved)); assert.equal(unapproved.calls.length, 0);
    process.env.SGM_LOCAL_DISPOSABLE_EMULATOR = 'true';
    const valid = device(); assert.equal(run(valid).noProcessAfterStop, true);
    assert.deepEqual(valid.calls.filter((args) => args.includes('force-stop')),
      [['-s', 'emulator-5554', 'shell', 'am', 'force-stop', appId]]);
    assert.equal(valid.writes.length, 2);
    assert(!valid.writes.some(([, text]) => text.includes('private-do-not-log')));
    for (const overrides of [{ qemu: '0' }, { session: JSON.stringify({ projectId: 'live', runId, disposableEmulator: true }) },
      { session: JSON.stringify({ projectId: 'demo-sgm-local-qa', runId: 'b'.repeat(32), disposableEmulator: true }) },
      { session: JSON.stringify({ projectId: 'demo-sgm-local-qa', runId, disposableEmulator: false }) },
      { before: JSON.stringify({ ...receipt()[0], completed: false }) }]) {
      const invalid = device(overrides); assert.throws(() => run(invalid));
      assert(!invalid.calls.some((args) => args.includes('force-stop'))); assert.equal(invalid.writes.length, 0);
    }
    const physical = device(); assert.throws(() => run(physical, 'physical')); assert.equal(physical.calls.length, 0);
    const malformed = device({ session: '{"password":"private-do-not-log",invalid}' });
    assert.throws(() => run(malformed), (error) => !error.message.includes('private-do-not-log'));
    const stillRunning = device({ pid: { status: 0, stdout: '101', stderr: '' } });
    assert.throws(() => run(stillRunning), /fully stopped/); assert.equal(stillRunning.writes.length, 0);
    const lostDevice = device({ pid: { status: null, stdout: '', stderr: 'device offline' } });
    assert.throws(() => run(lostDevice), /device error/);
    assert(!lostDevice.calls.some((args) => args.includes('force-stop')));
  } finally {
    if (inherited === undefined) delete process.env.SGM_LOCAL_DISPOSABLE_EMULATOR;
    else process.env.SGM_LOCAL_DISPOSABLE_EMULATOR = inherited;
  }
});

test('the additional cold-start stages retain all prior cases and require UI plus persisted message verification', () => {
  const runner = read('scripts/qa/local-android-session.mjs');
  const prepare = runner.indexOf("instrument(['LocalChatProcessRestartTest#prepareConfirmedConversation'], 1)");
  const stop = runner.indexOf('stopDisposableChatProcess(adb, serial, session.runId, evidenceDir)');
  const resume = runner.indexOf("instrument(['LocalChatProcessRestartTest#reopenConfirmedConversation'], 1)");
  assert(prepare > runner.indexOf('verifyNativeMembershipUi()'));
  assert(stop > prepare && resume > stop);
  const verifiedRestart = runner.indexOf('const chatRestart = await verifyChatRestartUi');
  const network = runner.indexOf('replayWithNetworkCleanup(adb, serial, session.runId, instrument)');
  assert(verifiedRestart > resume && network > verifiedRestart);
  assert(runner.indexOf('capturesCollected = true') > network);
  assert(runner.indexOf('const chatNetwork = await verifyChatNetworkUi') > network);
  assert(runner.indexOf("writeFileSync(resolve(evidenceDir, 'results.json')") > network);
  assert.match(runner, /const chatRestart = await verifyChatRestartUi/);
  assert.match(runner, /testCount: 20/); assert.match(runner, /'chat-confirmed-process-restart-ui'/);
  const native = read('android/app/src/androidTest/java/be/sportgreenmoove/app/ui/LocalChatProcessRestartTest.kt');
  assert.match(native, /createLocalAppComposeRule\(\)/);
  assert.match(native, /assertNotEquals\("A new app process is required"/);
  const reopened = native.slice(native.indexOf('@Test fun reopenConfirmedConversation'), native.indexOf('private fun stage'));
  assert(reopened.indexOf('FirebaseAuth.getInstance().currentUser?.uid') < reopened.indexOf('logout()'));
  assert(!reopened.slice(0, reopened.indexOf('logout()')).includes('login('));
  for (const key of ['sessionRestoredWithoutLogin', 'confirmedHistoryRestored', 'newSendConfirmed', 'driverReplyReceived'])
    assert(reopened.includes(key));
  const persisted = read('scripts/qa/local-chat-restart-ui.mjs');
  for (const expected of ['assert.equal(messages.size, 3', 'checkpoint.messageId', 'checkpoint.clientMessageId',
    'checkpoint.createdAtMillis', 'assert.equal(notes.size, 1)', "assert.equal(note.read, true)", 'unreadCount, 0)',
    'pending or unsent draft recovery is not tested']) assert(persisted.includes(expected));
  for (const workflow of ['native-ci', 'web-integration-smoke'])
    assert.equal(read(`.github/workflows/${workflow}.yml`).split('"tests/chat-process-restart.test.mjs"').length - 1, 2);
  assert(read('package.json').includes('tests/chat-process-restart.test.mjs'));
});

test('published restart evidence requires the full nineteen-case replay and unchanged persisted confirmed messages', () => {
  const directory = 'docs/release/evidence/local-chat-restart-2026-10-16/';
  const load = (name) => JSON.parse(read(directory + name));
  const run = load('results.json');
  assert.equal(run.runId, '10da7e922d2622ecf5668869113a4e44');
  assert.equal(run.testCount, 19); assert.equal(run.steps.length, 20);
  assert.equal(run.scope, 'local-ui-not-physical-device');
  assert(run.steps.every((step) => step.status === 'passed'));
  assert.equal(run.search.method, 'component-ui-with-explicit-fake-gateway');
  const before = load('local-chat-restart-before.json'), after = load('local-chat-restart-after.json');
  const stopped = load('local-chat-restart-stop.json');
  assertChatRestartReceipt(before, stopped, after, run.runId);
  assert.equal(stopped.observedBeforePid, null);
  assert.equal(run.chatRestart.preparedProcessId, before.processId);
  assert.equal(run.chatRestart.resumedProcessId, after.processId);
  assert.equal(run.chatRestart.messageCount, 3); assert.equal(run.chatRestart.notificationCount, 3);
  assert.equal(run.chatRestart.duplicateMessages, 0); assert.equal(run.chatRestart.originalMessageUnchanged, true);
  assert.equal(run.chatRestart.sessionRestoredWithoutLogin, true);
  const checkpoint = load('local-chat-restart-checkpoint.json'), persisted = load('local-chat-restart-persisted.json');
  assert.equal(checkpoint.runId, run.runId); assert.equal(persisted.runId, run.runId);
  assert.equal(checkpoint.sourceId, run.chatRestart.sourceId); assert.equal(persisted.sourceId, checkpoint.sourceId);
  assert.equal(checkpoint.messageCount, 1); assert.equal(checkpoint.notificationCount, 1);
  assert.equal(persisted.messages.length, 3);
  const first = persisted.messages.find((message) => message.messageId === checkpoint.messageId);
  assert(first); assert.equal(first.clientMessageId, checkpoint.clientMessageId);
  assert.equal(first.createdAtMillis, checkpoint.createdAtMillis);
  assert.equal(new Set(persisted.messages.map((message) => message.messageId)).size, 3);
  assert.equal(new Set(persisted.messages.map((message) => message.notificationId)).size, 3);
  assert.equal(new Set(persisted.messages.map((message) => message.clientMessageId)).size, 3);
  const bodies = new Map([
    ['Message confirmé avant relancement.', 'sgm-qa-parent'],
    ['Nouvel envoi après relancement.', 'sgm-qa-parent'],
    ['Réponse reçue après relancement.', 'sgm-qa-driver'],
  ]);
  for (const message of persisted.messages) {
    assert.equal(message.senderUserId, bodies.get(message.body)); bodies.delete(message.body);
    assert.match(message.clientMessageId, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    assert.equal(message.read, true);
    assert.equal(message.recipientUserId, message.senderUserId === 'sgm-qa-parent' ? 'sgm-qa-driver' : 'sgm-qa-parent');
  }
  assert.equal(bodies.size, 0);
  const network = load('local-chat-network-ui.json');
  assert.equal(network.runId, run.runId); assertChatNetworkReceipt(network); assertCellularRequestSetup(network);
  assert.equal(run.chatNetwork.duplicateMessages, 0);
  const files = readdirSync(new URL('../' + directory, import.meta.url)).filter((file) => file.endsWith('-instrumentation.txt'));
  assert.equal(files.length, 11);
  let count = 0;
  for (const file of files) {
    const cases = file.startsWith('LocalAppFlowTest-') ? 9 : 1;
    assertInstrumentationPassed(read(directory + file), cases); count += cases;
  }
  assert.equal(count, 19);
  const flow = content.flows.find((item) => item.id === 'messages');
  assert.equal(flow.ui.source, 'docs/release/evidence/local-ui-collection-2026-10-16/accepted-run/results.json'); assert.equal(flow.status, 'partial');
  assert(flow.ui.groups.includes('chat-confirmed-process-restart-ui'));
  assert.match(flow.remaining, /brouillons après fermeture/); assert.match(flow.remaining, /téléphones/);
  assert(flow.images.some((image) => image.file === 'chat-restart-reply'));
  assert.equal(captures['chat-restart-reply'], directory + 'local-chat-restart-reply.png');
  const png = readFileSync(new URL('../' + captures['chat-restart-reply'], import.meta.url));
  assert.equal(png.readUInt32BE(16), 1080); assert.equal(png.readUInt32BE(20), 2400);
  assert.match(read(directory + 'README.md'), /pending sends or unsent drafts/);
  assert.match(read(directory + 'README.md'), /not deployed to production/);
});

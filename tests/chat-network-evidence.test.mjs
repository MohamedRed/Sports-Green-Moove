import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { content, captures } from '../partner-portal/content.mjs';
import { assertChatNetworkReceipt } from '../scripts/qa/chat-network-evidence.mjs';
import { assertInstrumentationPassed } from '../scripts/qa/android-instrumentation-result.mjs';

const base = 'docs/release/evidence/local-chat-network-2026-10-16/';
const root = new URL('../', import.meta.url);
const bytes = (name) => readFileSync(new URL(base + name, root));
const read = (name) => bytes(name).toString('utf8');
const json = (name) => JSON.parse(read(name));

test('network claims require the completed seventeen-case replay and actual OS/endpoint transitions', () => {
  const run = json('results.json');
  const receipt = json('local-chat-network-ui.json');
  assertChatNetworkReceipt(receipt);
  assert.equal(run.runId, '1914c72fdb83f3cec9c59db6db6c21d8');
  assert.equal(run.runId, receipt.runId);
  assert.equal(run.testCount, 17); assert.equal(run.steps.length, 19);
  assert.equal(run.scope, 'local-ui-not-physical-device');
  assert(run.steps.every((step) => step.status === 'passed'));
  assert.equal(run.chatNetwork.messageCount, 2);
  assert.equal(run.chatNetwork.notificationCount, 2);
  assert.equal(run.chatNetwork.duplicateMessages, 0);
  assert(run.chatNetwork.offlineDraftRetained && run.chatNetwork.accountDraftCleared && run.chatNetwork.networkRestored);
  assert(run.chatNetwork.bookingStatuses.includes('declined'));
  assert(run.chatNetwork.bookingStatuses.includes('cancelled'));
  const service = json('services.json');
  assert.equal(service.scope, 'local-emulated-services-not-phone-ui');
  assert.equal(service.steps.length, 16);
  assert(service.steps.every((step) => step.status === 'passed'));
  const report = read('network-replay-passed.txt');
  assert.match(report, /OK \(1 test\)/);
  assert(!/FAILURES|INSTRUMENTATION_FAILED/.test(report));
  assert.equal(report, gunzipSync(bytes('network-replay-original.txt.gz')).toString('utf8').replace(/\n+$/, '\n'));
});

test('interrupted attempts cannot become recovery evidence and the status regression remains recorded', () => {
  assert.match(read('first-conversation-replay-failed.txt'), /SnapshotStateObserver/);
  for (const prefix of ['second', 'third', 'fifth']) {
    const receipt = json(`${prefix}-network-receipt.json`);
    assert.equal(receipt.completed, false);
    assert.throws(() => assertChatNetworkReceipt(receipt));
    assert.match(read(`${prefix}-network-replay-failed.txt`), /FAILURES/);
  }
  assert.equal(json('second-network-receipt.json').network.length, 0);
  assert.equal(json('third-network-receipt.json').failedPhase, 'disconnect');
  const fifth = json('fifth-network-receipt.json');
  assert.equal(fifth.failedPhase, 'disconnect');
  const cutoff = fifth.network.at(-1);
  assert.equal(cutoff.activeNetwork, false); assert.equal(cutoff.backendReachable, false);
  assert.equal(cutoff.internetNetworkCount, 0); assert.equal(cutoff.mobileDataEnabled, true);
  assert.match(read('booking-status-before.xml'), /tests="3" skipped="0" failures="1" errors="0"/);
  assert.match(read('booking-status-after.xml'), /tests="3" skipped="0" failures="0" errors="0"/);
});

test('partner media stays reviewed, partial and explicit about remaining phone and keyboard work', () => {
  const flow = content.flows.find((item) => item.id === 'messages');
  assert.equal(flow.status, 'partial');
  assert.equal(flow.ui.source, 'docs/release/evidence/native-matrix-67ab59c-2026-10-19/replay/results.json');
  assert.equal(flow.local.source, 'docs/release/evidence/local-booking-recovery-2026-10-17/services.json');
  assert.match(flow.remaining, /clavier/); assert.match(flow.remaining, /téléphones/);
  assert.match(flow.remaining, /groupe/); assert.match(flow.remaining, /Pas encore en ligne/);
  for (const file of ['local-chat-network-unconfirmed.png', 'booking-picker-recovered.png']) {
    const png = bytes(file);
    assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.equal(png.readUInt32BE(16), 1080); assert.equal(png.readUInt32BE(20), 2400);
    assert(Object.values(captures).includes(base + file));
  }
  assert(!Object.values(captures).some((path) => path.startsWith(base) && /network-(received|recovered|other-account)\.png/.test(path)));
  assert.match(read('README.md'), /not deployed to production/);
  assert.match(read('README.md'), /not identical active transport sets/);
});

test('the queued-scheduler replay proves recovery and retains the earlier crash as unresolved history', () => {
  const path = 'docs/release/evidence/local-app-scheduling-2026-10-16/';
  const readCurrent = (name) => readFileSync(new URL(path + name, root));
  const run = JSON.parse(readCurrent('results.json'));
  const ui = JSON.parse(readCurrent('local-chat-network-ui.json'));
  assertChatNetworkReceipt(ui);
  assert.equal(run.runId, '62d83d64a7752b4a9df39e6b6bdb5a55');
  assert.equal(ui.runId, run.runId);
  assert.equal(run.testCount, 17); assert.equal(run.steps.length, 19);
  assert(run.steps.every((step) => step.status === 'passed'));
  assert.deepEqual(ui.network.map((state) => state.phase), ['before', 'cellular-ready', 'offline', 'restored']);
  assert.equal(run.ride.auditEventCount, 4); assert.equal(run.ride.ratingCount, 1);
  assert.equal(run.reservationDecisions.declinedStatus, 'declined');
  assert.equal(run.chatNetwork.messageCount, 2); assert.equal(run.chatNetwork.notificationCount, 2);
  assert.equal(run.chatNetwork.duplicateMessages, 0);
  assert.equal(run.scope, 'local-ui-not-physical-device');
  assert.equal(run.search.method, 'component-ui-with-explicit-fake-gateway');
  const png = readCurrent('local-chat-network-received.png');
  assert.equal(png.readUInt32BE(16), 1080); assert.equal(png.readUInt32BE(20), 2400);
  assert(!Object.values(captures).includes(path + 'local-chat-network-received.png'));
  assert.match(readCurrent('network-replay-passed.txt').toString(), /OK \(1 test\)/);
  assert.match(readCurrent('README.md').toString(), /does not establish the SlotWriter root cause/);
});

test('the ride scheduling interruption cannot be mistaken for a network replay', () => {
  const path = 'docs/release/evidence/local-app-scheduling-2026-10-16/';
  const original = readFileSync(new URL(path + 'ride-scheduler-original.txt.gz', root));
  const failure = readFileSync(new URL(path + 'ride-scheduler-failed.txt', root), 'utf8');
  assert.equal(failure, gunzipSync(original).toString('utf8').replace(/\n+$/, '\n'));
  assert.match(failure, /CalledFromWrongThreadException/);
  assert.match(failure, /Expected: main Calling: OkHttp/);
  assert.match(failure, /TestMonotonicFrameClock/);
  assert.match(failure, /TasksKt\$awaitImpl/);
  assert.match(failure, /FAILURES/); assert(!/OK \(/.test(failure));
  const teardown = readFileSync(new URL(path + 'reservation-teardown-failed.txt', root), 'utf8');
  assert.match(teardown, /Process crashed while executing/);
  assert.match(teardown, /SlotWriter.moveSlotGapTo/);
  assert.match(teardown, /CompositionImpl.dispose/);
  assert.equal(teardown, gunzipSync(readFileSync(new URL(path + 'reservation-teardown-original.txt.gz', root)))
    .toString('utf8').replace(/\n+$/, '\n'));
});

test('completed instrumentation without collected evidence or final verification is not a complete replay', () => {
  const path = 'docs/release/evidence/local-app-scheduling-2026-10-16/transport-interrupted/';
  const files = readdirSync(new URL(path, root)).filter((name) => name.endsWith('-instrumentation.txt'));
  assert.equal(files.length, 9);
  let count = 0;
  for (const name of files) {
    const expected = name.startsWith('LocalAppFlowTest-') ? 9 : 1;
    assertInstrumentationPassed(readFileSync(new URL(path + name, root), 'utf8'), expected);
    count += expected;
  }
  assert.equal(count, 17);
  assert(!existsSync(new URL(path + 'results.json', root)));
  assert(!existsSync(new URL(path + 'local-chat-network-ui.json', root)));
  const log = readFileSync(new URL(path + 'transport-cleanup-failed.txt', root), 'utf8');
  assert.match(log, /device offline/); assert.match(log, /android:mock_location default/);
  assert.equal(content.flows.find((item) => item.id === 'messages').ui.source,
    'docs/release/evidence/native-matrix-67ab59c-2026-10-19/replay/results.json');
});

test('the unresolved cellular-readiness attempt stays incomplete and separate from accepted recovery evidence', () => {
  const path = 'docs/release/evidence/local-app-scheduling-2026-10-16/handover-interrupted/';
  const ui = JSON.parse(readFileSync(new URL(path + 'local-chat-network-ui.json', root), 'utf8'));
  assert.equal(ui.runId, 'c6a16ea31c5262ad6c682658758d4d68');
  assert.equal(ui.completed, false); assert.equal(ui.failedPhase, 'disconnect');
  assert.throws(() => assertChatNetworkReceipt(ui));
  assert.deepEqual(ui.network.map((state) => state.phase), ['before', 'disconnect-failed']);
  assert.deepEqual(ui.network[0].internetTransports, ['wifi']);
  assert.equal(ui.network[1].mobileDataEnabled, true);
  assert.equal(ui.network[1].activeNetwork, false); assert.equal(ui.network[1].backendReachable, false);
  const transcript = readFileSync(new URL(path + 'LocalChatNetworkFlowTest-instrumentation.txt', root), 'utf8');
  assert.match(transcript, /ComposeTimeoutException/); assert.match(transcript, /LocalEmulatorNetwork.disconnect/);
  assert.match(transcript, /FAILURES/); assert(!/OK \(/.test(transcript));
});

test('a later complete replay is retained without claiming the Wi-Fi-only setup or phone scope is resolved', () => {
  const path = 'docs/release/evidence/local-app-scheduling-2026-10-16/completed-repeat/';
  const load = (name) => readFileSync(new URL(path + name, root), 'utf8');
  const run = JSON.parse(load('results.json')), ui = JSON.parse(load('local-chat-network-ui.json'));
  assertChatNetworkReceipt(ui);
  assert.equal(run.runId, 'f8ff172474a879116b4a44015a717301'); assert.equal(ui.runId, run.runId);
  assert.equal(run.scope, 'local-ui-not-physical-device');
  assert.equal(run.testCount, 17); assert.equal(run.steps.length, 19);
  assert(run.steps.every((step) => step.status === 'passed'));
  assert.equal(run.chatNetwork.messageCount, 2); assert.equal(run.chatNetwork.notificationCount, 2);
  assert.equal(run.chatNetwork.duplicateMessages, 0);
  assert.deepEqual(ui.network[0].internetTransports, ['wifi', 'cellular']);
  assertInstrumentationPassed(load('LocalChatNetworkFlowTest-instrumentation.txt'), 1);
  assert.equal(content.flows.find((item) => item.id === 'messages').status, 'partial');
});

test('request registration and release do not turn a failed preparation into message-recovery evidence', () => {
  const path = 'docs/release/evidence/local-app-scheduling-2026-10-16/preparation-interrupted/';
  const ui = JSON.parse(readFileSync(new URL(path + 'local-chat-network-ui.json', root), 'utf8'));
  assert.equal(ui.runId, '2f170dc1fe0d80af6a004dc3c3fd9d66');
  assert.equal(ui.completed, false); assert.equal(ui.failedPhase, 'network-preparation');
  assert.deepEqual(ui.network, []);
  assert.equal(ui.preparation.cellularRequestRegistered, true); assert.equal(ui.cellularRequestReleased, true);
  assert.deepEqual(ui.preparation.internetTransports, ['wifi']);
  assert.throws(() => assertChatNetworkReceipt(ui));
  assert(!existsSync(new URL(path + 'results.json', root)));
  const transcript = readFileSync(new URL(path + 'LocalChatNetworkFlowTest-instrumentation.txt', root), 'utf8');
  assert.match(transcript, /ComposeTimeoutException/); assert.match(transcript, /30000 ms/);
  assert.match(transcript, /LocalChatNetworkFlowTest.kt:74/); assert.match(transcript, /FAILURES/);
});

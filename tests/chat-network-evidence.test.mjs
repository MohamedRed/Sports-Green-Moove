import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { content, captures } from '../partner-portal/content.mjs';
import { assertChatNetworkReceipt } from '../scripts/qa/chat-network-evidence.mjs';

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
  assert.equal(flow.ui.source, base + 'results.json');
  assert.equal(flow.local.source, base + 'services.json');
  assert.match(flow.remaining, /clavier/); assert.match(flow.remaining, /téléphones/);
  assert.match(flow.remaining, /groupe/); assert.match(flow.remaining, /Pas encore en ligne/);
  for (const file of ['local-chat-network-unconfirmed.png', 'booking-picker-recovered.png']) {
    const png = bytes(file);
    assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.equal(png.readUInt32BE(16), 1080); assert.equal(png.readUInt32BE(20), 2400);
    assert(Object.values(captures).includes(base + file));
  }
  assert(!Object.values(captures).some((path) => /network-(received|recovered|other-account)\.png/.test(path)));
  assert.match(read('README.md'), /not deployed to production/);
  assert.match(read('README.md'), /not identical active transport sets/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { XMLParser } from 'fast-xml-parser';
import { assertChatRestartInteractionReceipt } from '../scripts/qa/chat-restart-evidence.mjs';
import { assertChatLossReceipt } from '../scripts/qa/chat-loss-evidence.mjs';
import { assertChatNetworkReceipt } from '../scripts/qa/chat-network-evidence.mjs';
import { assertInstrumentationPassed } from '../scripts/qa/android-instrumentation-result.mjs';
import { content, captures } from '../partner-portal/content.mjs';

const base = 'docs/release/evidence/local-chat-restart-recheck-2026-10-16/second-run/';
const root = fileURLToPath(new URL('../', import.meta.url));
const bytes = (name) => readFileSync(resolve(root, base, name));
const text = (name) => bytes(name).toString('utf8');
const json = (name) => JSON.parse(text(name));
const runId = '36b241fed563bc222c20e4cb9a92a7bc';

test('the new restart stage requires strict input, different process and unchanged persisted original message', () => {
  const before = json('local-chat-restart-before.json'), after = json('local-chat-restart-after.json');
  assertChatRestartInteractionReceipt(before, json('local-chat-restart-stop.json'), after, runId);
  for (const method of ['prepare', 'reopen']) assertInstrumentationPassed(
    text(`LocalChatProcessRestartTest#${method}ConfirmedConversation-instrumentation.txt`), 1);
  const checkpoint = json('local-chat-restart-checkpoint.json'), persisted = json('local-chat-restart-persisted.json');
  assert.equal(checkpoint.runId, runId); assert.equal(persisted.runId, runId);
  assert.equal(persisted.projectId, before.projectId); assert.equal(persisted.sourceId, checkpoint.sourceId);
  assert.equal(persisted.scope, 'local-persisted-confirmed-conversation-restart');
  assert.equal(persisted.messages.length, 3);
  for (const key of ['messageId', 'clientMessageId', 'notificationId']) {
    assert.equal(new Set(persisted.messages.map((message) => message[key])).size, 3);
  }
  const expected = new Map([
    ['Message confirmé avant relancement.', 'sgm-qa-parent'],
    ['Nouvel envoi après relancement.', 'sgm-qa-parent'],
    ['Réponse reçue après relancement.', 'sgm-qa-driver'],
  ]);
  for (const message of persisted.messages) {
    assert.equal(message.senderUserId, expected.get(message.body)); expected.delete(message.body);
    assert.equal(message.recipientUserId, message.senderUserId === 'sgm-qa-parent' ? 'sgm-qa-driver' : 'sgm-qa-parent');
    assert.equal(message.read, true);
  }
  assert.equal(expected.size, 0);
  const original = persisted.messages.find((message) => message.messageId === checkpoint.messageId);
  assert.equal(original.clientMessageId, checkpoint.clientMessageId);
  assert.equal(original.createdAtMillis, checkpoint.createdAtMillis);
  assert.equal(checkpoint.messageCount, 1); assert.equal(checkpoint.notificationCount, 1);
});

test('controlled reply loss and successful stage copies cannot promote the failed network replay', () => {
  const proxy = json('local-chat-loss-proxy.json');
  assertChatLossReceipt(json('local-chat-loss-ui.json'), proxy, runId, proxy.sourceId);
  assertInstrumentationPassed(text('LocalChatResponseLossTest-instrumentation.txt'), 1);
  const versions = new Set();
  for (const phase of ['confirmed-restart', 'response-loss', 'failure-cleanup']) {
    const copy = json(`adb-pull-${phase}.json`);
    assert.equal(copy.runId, runId); assert.equal(copy.projectId, 'demo-sgm-local-qa');
    assert.equal(copy.phase, phase); assert.equal(copy.completed, true); assert.equal(copy.status, 0);
    assert.equal(copy.signal, null); assert.equal(copy.errorCode, null); versions.add(copy.version);
  }
  assert.equal(versions.size, 1);
  const network = json('local-chat-network-ui.json');
  assert.equal(network.runId, runId); assert.equal(network.completed, false);
  assert.equal(network.failedPhase, 'network-preparation'); assert.deepEqual(network.network, []);
  assert.equal(network.cellularRequestReleased, true);
  for (const snapshot of [network.preparation, network.preparationFailure]) {
    assert.equal(snapshot.simState, 5); assert.equal(snapshot.cellularDataState, 0);
    assert.equal(snapshot.hasDefaultDataSubscription, false); assert.equal(snapshot.cellularAvailableCallbacks, 0);
    assert.equal(snapshot.mobileDataEnabled, true); assert.equal(snapshot.backendReachable, true);
    assert.deepEqual(snapshot.internetTransports, ['wifi']);
  }
  for (const phase of ['before', 'after']) {
    const modem = json(`chat-modem-${phase}.json`);
    assert.equal(modem.runId, runId); assert.equal(modem.voice, 'home'); assert.equal(modem.data, 'home');
  }
  assert.throws(() => assertChatNetworkReceipt(network));
  assert.throws(() => assertInstrumentationPassed(text('LocalChatNetworkFlowTest-instrumentation.txt'), 1));
  for (const name of ['results.json', 'adb-pull-network-recovery.json']) {
    assert.equal(existsSync(new URL('../' + base + name, import.meta.url)), false);
  }
});

test('new raw evidence is byte-pinned and the ordinary component pass stays separate', () => {
  const hashes = json('artifact-sha256.json'); assert.equal(Object.keys(hashes).length, 20);
  for (const [name, hash] of Object.entries(hashes)) {
    assert.equal(createHash('sha256').update(bytes(name)).digest('hex'), hash, name);
  }
  const suite = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '', parseAttributeValue: true,
    isArray: (name) => name === 'testcase' }).parse(text('ordinary-components.xml')).testsuite;
  assert.equal(suite.tests, 73); assert.equal(suite.testcase.length, 73);
  assert.equal(suite.failures, 0); assert.equal(suite.errors, 0); assert.equal(suite.skipped, 16);
  assert.match(text('README.md'), /failed full/); assert.match(text('README.md'), /remains unresolved/);
});

test('the private update shows only the verified restart stage and keeps the latest interruption explicit', () => {
  const flow = content.flows.find((item) => item.id === 'messages');
  assert.equal(flow.status, 'partial'); assert.match(flow.summary, /nouvel essai de coupure passe/);
  assert.match(flow.remaining, /Répéter les essais de coupure/);
  assert.equal(flow.ui.source, 'docs/release/evidence/local-dual-transport-2026-10-17/completed/results.json');
  const issue = content.blockers.find((item) => item.id === 'chat-send-stability');
  assert.equal(issue.source, 'docs/release/evidence/local-dual-transport-2026-10-17/README.md');
  assert.match(issue.text, /précédents/);
  const image = flow.images.find((item) => item.file === 'chat-restart-recheck-reply');
  assert.match(image.alt, /revérifié en local/);
  assert.equal(captures[image.file], base + 'local-chat-restart-reply.png');
  assert(!Object.values(captures).includes(base + 'local-chat-network-failed.png'));
  const png = bytes('local-chat-restart-reply.png');
  assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  assert.equal(png.readUInt32BE(16), 1080); assert.equal(png.readUInt32BE(20), 2400);
  const workflow = readFileSync(new URL('../.github/workflows/web-integration-smoke.yml', import.meta.url), 'utf8');
  assert.equal(workflow.split('"tests/chat-restart-recheck-evidence.test.mjs"').length - 1, 2);
  assert.match(workflow, /run: node --test[^\n]*tests\/chat-restart-recheck-evidence.test.mjs/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { XMLParser } from 'fast-xml-parser';
import { assertInstrumentationPassed } from '../scripts/qa/android-instrumentation-result.mjs';
import { assertChatNetworkReceipt, assertCellularRequestSetup, assertObservedCellularHandover } from '../scripts/qa/chat-network-evidence.mjs';
import { assertBookingUiLoss } from '../scripts/qa/booking-ui-loss-evidence.mjs';
import { content, captures } from '../partner-portal/content.mjs';

const base = 'docs/release/evidence/local-default-selection-2026-10-17/';
const bytes = (file) => readFileSync(new URL(file.split('/').map(encodeURIComponent).join('/'), new URL(`../${base}`, import.meta.url)));
const text = (file) => bytes(file).toString();
const json = (file) => JSON.parse(text(file));
const current = (file) => json('completed/' + file);
const runId = 'cf2ba260731eb634ae9f9b9c143ba656';

test('both the interrupted baseline and the completed comparison retain original bytes', () => {
  assert.equal(createHash('sha256').update(bytes('artifact-sha256.json')).digest('hex'),
    'c2e16388a0241e7d9383cc6d04d30bbe1fd85c9b426f61ba2dbe592ae0964612');
  const hashes = json('artifact-sha256.json'); assert.equal(Object.keys(hashes).length, 51);
  for (const [file, hash] of Object.entries(hashes)) {
    assert.match(file, /^(completed\/)?[\w#.-]+$/);
    assert.equal(createHash('sha256').update(bytes(file)).digest('hex'), hash, file);
    if (!file.endsWith('.png')) assert(!/-----BEGIN [A-Z ]*PRIVATE KEY-----|AIza[\w-]{30}|sk_live_[\w]+|Bearer eyJ/.test(text(file)));
  }
});

test('loaded SIM and modem registration did not prove selection or a connection-loss test', () => {
  const failed = json('local-chat-network-ui.json');
  assert.equal(failed.runId, '534e47a793145a3b8e51f08c3ae1cc08');
  assert.equal(failed.completed, false); assert.equal(failed.failedPhase, 'network-preparation');
  assert.deepEqual(failed.network, []);
  assert.throws(() => assertChatNetworkReceipt(failed));
  assert.throws(() => assertInstrumentationPassed(text('LocalChatNetworkFlowTest-instrumentation.txt'), 1));
  for (const phase of ['before', 'after']) {
    const sub = json(`chat-subscriptions-${phase}.json`), modem = json(`chat-modem-${phase}.json`);
    assert.equal(sub.runId, failed.runId); assert.equal(modem.runId, failed.runId);
    assert.equal(sub.allSubscriptionsLoaded, true); assert.deepEqual(sub.simStates, ['LOADED']);
    assert.equal(sub.mappedSlotCount, 1); assert.equal(sub.defaultSubscriptionValid.defaultDataSubId, false);
    assert.equal(sub.defaultSubscriptionValid.activeDataSubId, false);
    assert.equal(modem.voice, 'home'); assert.equal(modem.data, 'home');
  }
});

test('the completed run executes all 24 actual cases and retains the ordinary suite separately', () => {
  const run = current('results.json');
  assert.equal(run.projectId, 'demo-sgm-local-qa'); assert.equal(run.runId, runId);
  assert.equal(run.scope, 'local-ui-not-physical-device'); assert.equal(run.testedAt, '2026-10-17T09:20:14.276Z');
  assert.equal(run.testCount, 24); assert.equal(run.steps.length, 24);
  assert.equal(new Set(run.steps.map((step) => step.id)).size, 24);
  assert(run.steps.every((step) => step.status === 'passed'));
  const transcripts = Object.keys(json('artifact-sha256.json')).filter((file) => file.startsWith('completed/') && file.endsWith('-instrumentation.txt'));
  assert.equal(transcripts.length, 16);
  let cases = 0;
  for (const file of transcripts) {
    const count = file.startsWith('completed/LocalAppFlowTest-') ? 9 : 1;
    assertInstrumentationPassed(text(file), count); cases += count;
  }
  assert.equal(cases, 24);
  const suite = new XMLParser({ ignoreAttributes: false }).parse(text('completed/general-ui.xml')).testsuite;
  assert.equal(Number(suite['@_tests']), 88); assert.equal(Number(suite['@_skipped']), 19);
  assert.equal(Number(suite['@_failures']), 0); assert.equal(Number(suite['@_errors']), 0);
  assertBookingUiLoss(current('booking-ui-loss.json'), runId);
  assert.deepEqual(run.bookingUiResponseLoss, current('booking-ui-loss.json'));
});

test('fresh handover, offline and restored app evidence remain independently required', () => {
  const ui = current('local-chat-network-ui.json');
  assertChatNetworkReceipt(ui); assertCellularRequestSetup(ui); assertObservedCellularHandover(ui);
  assert.equal(ui.runId, runId); assert(ui.network.every((state) => state.hasDefaultDataSubscription));
  const saved = current('results.json').chatNetwork;
  assert.equal(saved.messageCount, 2); assert.equal(saved.notificationCount, 2); assert.equal(saved.duplicateMessages, 0);
  for (const phase of ['before', 'after']) {
    const sub = current(`chat-subscriptions-${phase}.json`);
    assert.equal(sub.runId, runId); assert(Object.values(sub.defaultSubscriptionValid).every(Boolean));
    const history = current(`chat-default-selection-${phase}.json`);
    assert.equal(history.runId, runId); assert.equal(history.scope, 'read-only-disposable-default-selection-history');
    assert.equal(history.recognizedEventCount, 0); assert.equal(history.unrecognizedMessageCount, 0);
    assert.deepEqual(history.events, []); assert.equal(history.lastReadiness, null);
    assert.equal(history.source, 'bounded-controller-log-history-not-current-os-state');
  }
});

test('current captures and dates cannot promote this comparison to physical or stable readiness', () => {
  const flow = content.flows.find((item) => item.id === 'messages');
  assert.equal(flow.status, 'partial'); assert.equal(flow.checkedAt, '2026-10-17');
  assert.equal(flow.ui.source, base + 'completed/results.json'); assert.equal(flow.source, base + 'README.md');
  const blocker = content.blockers.find((item) => item.id === 'chat-send-stability');
  assert.equal(blocker.source, base + 'README.md'); assert.match(blocker.text, /instable/);
  for (const [id, file] of [['chat-network-current-draft', 'local-chat-network-unconfirmed.png'],
    ['chat-network-current-reply', 'local-chat-network-received.png']]) {
    assert.equal(captures[id], base + 'completed/' + file);
    assert(flow.images.some((image) => image.file === id && /17 octobre/.test(image.alt)));
    const png = bytes('completed/' + file);
    assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.equal(png.readUInt32BE(16), 1080); assert.equal(png.readUInt32BE(20), 2400);
  }
  assert.equal(content.flows.find((item) => item.id === 'tracking').status, 'untested');
  const workflow = readFileSync(new URL('../.github/workflows/web-integration-smoke.yml', import.meta.url), 'utf8');
  assert.equal(workflow.split('"tests/default-selection-evidence.test.mjs"').length - 1, 2);
  assert(workflow.includes('node --test tests/default-selection-evidence.test.mjs'));
});

test('the subsequent recheck stays failed with no inferred controller readiness or full result', () => {
  const prefix = 'interrupted-recheck/';
  assert.equal(createHash('sha256').update(bytes(prefix + 'artifact-sha256.json')).digest('hex'),
    '0e7210a3d3062b71b325c72478b4b7b2a3be4f718bbd2ed6c8fa2d631e11eae7');
  const hashes = json(prefix + 'artifact-sha256.json'); assert.equal(Object.keys(hashes).length, 8);
  for (const [file, hash] of Object.entries(hashes)) {
    assert.match(file, /^[\w.-]+$/);
    assert.equal(createHash('sha256').update(bytes(prefix + file)).digest('hex'), hash, file);
  }
  const ui = json(prefix + 'local-chat-network-ui.json');
  assert.equal(ui.runId, 'aeca3bbbb4047fd169b3e7d54511efec');
  assert.equal(ui.completed, false); assert.deepEqual(ui.network, []);
  assert.equal(ui.failedPhase, 'network-preparation');
  assert.equal(ui.preparationFailure.hasDefaultDataSubscription, false);
  assert.throws(() => assertChatNetworkReceipt(ui));
  assert.throws(() => assertInstrumentationPassed(text(prefix + 'LocalChatNetworkFlowTest-instrumentation.txt'), 1));
  for (const phase of ['before', 'after']) {
    const history = json(prefix + `chat-default-selection-${phase}.json`);
    assert.equal(history.runId, ui.runId); assert.equal(history.lastReadiness, null);
    assert.deepEqual(history.events, []); assert.equal(history.recognizedEventCount, 0);
    const subscription = json(prefix + `chat-subscriptions-${phase}.json`);
    assert.equal(subscription.runId, ui.runId); assert.equal(subscription.allSubscriptionsLoaded, true);
    assert.equal(subscription.defaultSubscriptionValid.defaultDataSubId, false);
  }
  assert(content.updates.some((update) => update.title === 'La préparation bloque encore un essai'));
  assert.match(content.flows.find((flow) => flow.id === 'messages').summary, /^Un essai local complet passe/);
});

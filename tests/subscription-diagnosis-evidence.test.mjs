import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { assertInstrumentationPassed } from '../scripts/qa/android-instrumentation-result.mjs';
import { assertChatNetworkReceipt, assertCellularRequestSetup } from '../scripts/qa/chat-network-evidence.mjs';
import { content } from '../partner-portal/content.mjs';

const base = 'docs/release/evidence/local-subscription-diagnosis-2026-10-17/';
const bytes = (name) => readFileSync(new URL(encodeURIComponent(name), new URL(`../${base}`, import.meta.url)));
const text = (name) => bytes(name).toString();
const json = (name) => JSON.parse(text(name));
const runId = 'f6abebee31f9938c2dbae2cb916bd826';

test('retained successful and failed diagnostic artifacts preserve their exact original bytes', () => {
  assert.equal(createHash('sha256').update(bytes('artifact-sha256.json')).digest('hex'),
    'cdd6e4fcf02e8a01ae4af9290ca3fa579b63676966a51e09a4e4442673e502c1');
  const hashes = json('artifact-sha256.json'); assert.equal(Object.keys(hashes).length, 26);
  for (const [file, hash] of Object.entries(hashes)) {
    assert.match(file, /^[\w#.-]+$/);
    assert.equal(createHash('sha256').update(bytes(file)).digest('hex'), hash, file);
    assert(!/-----BEGIN [A-Z ]*PRIVATE KEY-----|AIza[\w-]{30}|sk_live_[\w]+|Bearer eyJ/.test(text(file)));
  }
});

test('complete local replay has 23 executed cases and verified groups, not just a green workflow', () => {
  const result = json('results.json');
  assert.equal(result.projectId, 'demo-sgm-local-qa'); assert.equal(result.runId, runId);
  assert.equal(result.scope, 'local-ui-not-physical-device');
  assert.equal(result.testedAt, '2026-10-17T06:54:54.029Z');
  assert.equal(result.testCount, 23); assert.equal(result.steps.length, 23);
  assert.equal(new Set(result.steps.map((step) => step.id)).size, 23);
  assert(result.steps.every((step) => step.status === 'passed'));
  const transcripts = Object.keys(json('artifact-sha256.json')).filter((name) =>
    name.startsWith('native-') && name.endsWith('.txt') && !name.includes('failed'));
  assert.equal(transcripts.length, 15);
  let count = 0;
  for (const name of transcripts) {
    const expected = name.startsWith('native-LocalAppFlowTest-') ? 9 : 1;
    assertInstrumentationPassed(text(name), expected); count += expected;
  }
  assert.equal(count, 23);
});

test('service and app observations agree in the working comparison run without proving earlier provisioning fixed', () => {
  for (const phase of ['before', 'after']) {
    const state = json(`chat-subscriptions-${phase}.json`);
    assert.equal(state.runId, runId); assert.equal(state.phase, phase);
    assert.equal(state.scope, 'read-only-disposable-subscription-summary');
    assert.equal(state.modemCount, 1); assert.equal(state.supportedSlotCount, 1);
    assert.equal(state.mappedSlotCount, 1); assert.equal(state.allSubscriptionsLoaded, true);
    assert.deepEqual(state.simStates, ['LOADED']);
    assert(Object.values(state.defaultSubscriptionValid).every((valid) => valid === true));
    assert.deepEqual(state.events, ['subscription-inactive', 'sim-NOT_READY', 'subscription-inactive',
      'sim-READY', 'mapping-single', 'sim-LOADED', 'mapping-single']);
    assert.equal(state.eventsTruncated, false); assert.equal(state.recognizedEventCount, 7);
    assert(!/iccId|phoneNumber|subscriberId|rawOutput/.test(JSON.stringify(state)));
  }
  const ui = json('local-chat-network-ui.json');
  assertChatNetworkReceipt(ui); assertCellularRequestSetup(ui);
  assert.equal(ui.runId, runId); assert.equal(ui.completed, true);
  assert(ui.network.every((state) => state.hasDefaultDataSubscription === true));
  assert.deepEqual(ui.network.map((state) => state.phase), ['before', 'cellular-ready', 'offline', 'restored']);
  const independent = json('results.json').chatNetwork;
  assert.equal(independent.messageCount, 2); assert.equal(independent.notificationCount, 2);
  assert.equal(independent.duplicateMessages, 0);
});

test('previous preparation timeout remains an interrupted run with no actual network cut', () => {
  const failed = json('failed-network-preparation.json');
  assert.equal(failed.runId, '21474b37d3bb195c96bf0146dd0c252f');
  assert.equal(failed.completed, false); assert.equal(failed.failedPhase, 'network-preparation');
  assert.deepEqual(failed.network, []); assert.equal(failed.cellularRequestReleased, true);
  assert.equal(failed.preparationFailure.hasDefaultDataSubscription, false);
  assert.deepEqual(failed.preparationFailure.internetTransports, ['wifi']);
  assert.equal(failed.preparationFailure.cellularAvailableCallbacks, 0);
  assert.throws(() => assertChatNetworkReceipt(failed));
  assert.throws(() => assertInstrumentationPassed(text('native-failed-network-instrumentation.txt'), 1));
  assert.match(text('native-failed-network-instrumentation.txt'), /LocalChatNetworkFlowTest.kt:74/);
  for (const phase of ['before', 'after']) {
    const modem = json(`failed-modem-${phase}.json`);
    assert.equal(modem.runId, failed.runId); assert.equal(modem.voice, 'home'); assert.equal(modem.data, 'home');
  }
});

test('SDK process recovery still produces one booking and cannot become a physical or interactive claim', () => {
  const result = json('native-booking-loss.json');
  assert.equal(result.runId, runId); assert.equal(result.scope, 'native-sdk-booking-response-loss-not-ui');
  assert.equal(result.completed, true); assert.equal(result.bookingCount, 1); assert.equal(result.receiptCount, 1);
  assert.equal(result.attempts.length, 2); assert.equal(result.attempts[0].acknowledgementDropped, true);
  assert.equal(result.before.processId, 5942); assert.equal(result.after.processId, 6038);
  assert.equal(result.before.clientRequestId, result.after.clientRequestId);
  assert.equal(result.after.bookingId, result.attempts[0].commit.bookingId);
  assert.equal(result.stopped.noProcessAfterStop, true);
  assert.equal(result.after.pendingClearedAfterAcknowledgement, true);
  assert.equal(result.livePayment, false); assert.equal(result.productionDeployed, false);
  assert.deepEqual(json('results.json').bookingResponseLoss, result);
});

test('private progress keeps local scope and instability explicit, with unchanged historical captures', () => {
  const flow = content.flows.find((item) => item.id === 'messages');
  assert.equal(flow.status, 'partial');
  assert.equal(flow.ui.source, 'docs/release/evidence/native-matrix-67ab59c-2026-10-19/replay/results.json');
  const blocker = content.blockers.find((item) => item.id === 'chat-send-stability');
  assert.equal(blocker.source, content.nativeVerification.source);
  assert.match(blocker.text, /en simulation/); assert.notEqual(blocker.source, blocker.latestSource);
  assert(content.updates.some(row => row.flow === 'messages' && /avant la coupure/.test(row.text)));
  assert(content.updates.some((item) => item.title === 'Le nouvel essai complet passe'));
  const report = text('README.md');
  assert.match(report, /146730fba6e39a517922d91ac670627e50a23b8f/);
  assert.match(report, /not\*\* the cause/); assert.match(report, /remain incomplete/);
});

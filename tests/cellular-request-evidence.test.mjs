import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { assertChatNetworkReceipt, assertCellularRequestSetup } from '../scripts/qa/chat-network-evidence.mjs';
import { assertInstrumentationPassed } from '../scripts/qa/android-instrumentation-result.mjs';
import { content, captures } from '../partner-portal/content.mjs';

const base = 'docs/release/evidence/local-cellular-request-2026-10-16/';
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url));
const json = (name) => JSON.parse(read(base + name));

test('missing subscription diagnostics cannot promote an incomplete run or its unreached restart stages', () => {
  const directory = base + 'missing-subscription/';
  const load = (name) => JSON.parse(read(directory + name));
  const ui = load('local-chat-network-ui.json');
  assert.equal(ui.runId, '3395ada5fef241985ec11d2176cde793');
  assert.equal(ui.completed, false); assert.equal(ui.failedPhase, 'network-preparation');
  assert.equal(ui.network.length, 0); assert.equal(ui.cellularRequestReleased, true);
  assert.throws(() => assertChatNetworkReceipt(ui));
  for (const snapshot of [ui.preparation, ui.preparationFailure]) {
    assert.equal(snapshot.simState, 5); assert.equal(snapshot.cellularDataState, 0);
    assert.equal(snapshot.hasDefaultDataSubscription, false);
    assert.equal(snapshot.cellularRequestRegistered, true); assert.equal(snapshot.cellularAvailableCallbacks, 0);
    assert.deepEqual(snapshot.internetTransports, ['wifi']);
    assert.equal(snapshot.mobileDataAlwaysOnSetting, '1'); assert.equal(snapshot.airplaneModeSetting, '0');
  }
  for (const phase of ['before', 'after']) {
    const modem = load(`chat-modem-${phase}.json`);
    assert.equal(modem.runId, ui.runId); assert.equal(modem.phase, phase);
    assert.equal(modem.voice, 'home'); assert.equal(modem.data, 'home');
  }
  const files = readdirSync(new URL('../' + directory, import.meta.url));
  const prior = files.filter((name) => name.endsWith('-instrumentation.txt') && !name.startsWith('LocalChatNetworkFlowTest'));
  assert.equal(prior.length, 8);
  let count = 0;
  for (const name of prior) {
    const cases = name.startsWith('LocalAppFlowTest-') ? 9 : 1;
    assertInstrumentationPassed(read(directory + name).toString(), cases); count += cases;
  }
  assert.equal(count, 16);
  assert.match(read(directory + 'LocalChatNetworkFlowTest-instrumentation.txt').toString(), /FAILURES!!!/);
  assert(!files.some((name) => name.includes('restart')));
  assert(!existsSync(new URL('../' + directory + 'results.json', import.meta.url)));
});

test('the published request replay requires complete app, offline, handover, release and persisted outcomes', () => {
  const run = json('results.json'), ui = json('local-chat-network-ui.json');
  assert.equal(run.runId, '6b443eedcf95da94692b59b734524311'); assert.equal(ui.runId, run.runId);
  assert.equal(run.testCount, 17); assert.equal(run.steps.length, 19);
  assert(run.steps.every((step) => step.status === 'passed'));
  assert.equal(run.scope, 'local-ui-not-physical-device');
  assert.equal(run.search.method, 'component-ui-with-explicit-fake-gateway');
  assertChatNetworkReceipt(ui); assertCellularRequestSetup(ui);
  assert.equal(run.chatNetwork.messageCount, 2); assert.equal(run.chatNetwork.notificationCount, 2);
  assert.equal(run.chatNetwork.duplicateMessages, 0);
  assert(run.chatNetwork.offlineDraftRetained && run.chatNetwork.accountDraftCleared);
  assert.equal(ui.network[0].cellularAvailableCallbacks, 1);
  assert.equal(ui.network[2].cellularLostCallbacks, 1);
  assert.equal(ui.network[3].cellularAvailableCallbacks, 2);
  assertInstrumentationPassed(read(base + 'LocalChatNetworkFlowTest-instrumentation.txt').toString(), 1);
});

test('read-only modem evidence stays run-bound and does not claim the earlier Wi-Fi-only startup was reproduced', () => {
  const ui = json('local-chat-network-ui.json');
  for (const phase of ['before', 'after']) {
    const modem = json(`chat-modem-${phase}.json`);
    assert.equal(modem.projectId, 'demo-sgm-local-qa'); assert.equal(modem.runId, ui.runId);
    assert.equal(modem.phase, phase); assert.equal(modem.scope, 'read-only-disposable-modem-registration');
    assert.equal(modem.voice, 'home'); assert.equal(modem.data, 'home');
  }
  assert.deepEqual(ui.preparation.internetTransports, ['wifi', 'cellular']);
  assert.equal(ui.preparation.mobileDataAlwaysOnSetting, '1');
  const report = read(base + 'README.md').toString();
  assert.match(report, /does not reproduce the earlier Wi-Fi-only preparation failure/);
  assert.match(report, /not deployed to production/);
});

test('the reviewed current capture and source stay partial and retain the approved parent audience', () => {
  const flow = content.flows.find((item) => item.id === 'messages');
  assert.equal(flow.status, 'partial');
  assert.equal(flow.ui.source, 'docs/release/evidence/local-default-selection-2026-10-17/completed/results.json');
  const png = read(base + 'local-chat-network-received.png');
  assert.equal(png.readUInt32BE(16), 1080); assert.equal(png.readUInt32BE(20), 2400);
  assert.equal(captures['chat-network-reply'], base + 'local-chat-network-received.png');
  assert.match(content.blockers.find((item) => item.id === 'group-conversation').text, /parents des enfants inscrits/);
  const smoke = read('.github/workflows/web-integration-smoke.yml').toString();
  assert.equal(smoke.split('"tests/cellular-request-evidence.test.mjs"').length - 1, 2);
  assert(smoke.includes('tests/chat-network-evidence.test.mjs tests/cellular-request-evidence.test.mjs'));
});

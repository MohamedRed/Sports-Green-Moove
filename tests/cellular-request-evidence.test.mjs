import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { assertChatNetworkReceipt, assertCellularRequestSetup } from '../scripts/qa/chat-network-evidence.mjs';
import { assertInstrumentationPassed } from '../scripts/qa/android-instrumentation-result.mjs';
import { content, captures } from '../partner-portal/content.mjs';

const base = 'docs/release/evidence/local-cellular-request-2026-10-16/';
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url));
const json = (name) => JSON.parse(read(base + name));

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
  assert.equal(flow.status, 'partial'); assert.equal(flow.ui.source, base + 'results.json');
  const png = read(base + 'local-chat-network-received.png');
  assert.equal(png.readUInt32BE(16), 1080); assert.equal(png.readUInt32BE(20), 2400);
  assert.equal(captures['chat-network-reply'], base + 'local-chat-network-received.png');
  assert.match(content.blockers.find((item) => item.id === 'group-conversation').text, /parents des enfants inscrits/);
  const smoke = read('.github/workflows/web-integration-smoke.yml').toString();
  assert.equal(smoke.split('"tests/cellular-request-evidence.test.mjs"').length - 1, 2);
  assert(smoke.includes('tests/chat-network-evidence.test.mjs tests/cellular-request-evidence.test.mjs'));
});

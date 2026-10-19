import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { XMLParser } from 'fast-xml-parser';
import { assertChatNetworkReceipt } from '../scripts/qa/chat-network-evidence.mjs';
import { assertInstrumentationPassed } from '../scripts/qa/android-instrumentation-result.mjs';
import { content } from '../partner-portal/content.mjs';

const base = 'docs/release/evidence/local-input-readiness-2026-10-17/';
const url = new URL('../' + base, import.meta.url);
const bytes = (name) => readFileSync(new URL(name.split('/').map(encodeURIComponent).join('/'), url));
const json = (name) => JSON.parse(bytes(name));
const suite = (phase) => new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '', parseAttributeValue: true,
  isArray: (name) => name === 'testcase' }).parse(bytes(phase + '/general-ui.xml')).testsuite;

test('two actual keyboard probes and previously failing cases pass without closing the independent full replay', () => {
  const before = suite('before'), after = suite('after');
  assert.equal(before.tests, 99); assert.equal(after.tests, 101);
  for (const run of [before, after]) {
    assert.equal(run.failures, 0); assert.equal(run.errors, 0); assert.equal(run.skipped, 19);
    assert.equal(run.testcase.filter((item) => Object.hasOwn(item, 'failure')).length, 0);
  }
  const probes = after.testcase.filter((item) => item.classname.endsWith('.InputWindowReadinessTest'));
  assert.equal(probes.length, 2); assert(probes.every((item) => !Object.hasOwn(item, 'skipped')));
  for (const [name, count] of [['ConversationFlowTest', 6], ['TripChangeFlowTest', 7], ['TripCancellationFlowTest', 3]]) {
    const cases = after.testcase.filter((item) => item.classname.endsWith('.' + name));
    assert.equal(cases.length, count); assert(cases.every((item) => !Object.hasOwn(item, 'skipped')));
  }
  const logs = Object.keys(json('artifact-sha256.json')).filter((name) => name.startsWith('after/logcat-'));
  assert.equal(logs.length, 9);
  for (const name of logs) {
    const text = bytes(name).toString();
    assert.match(text, /phase=\S+-keyboard-visible .*windowFocused=true .*servedView=true acceptingText=true keyboardVisible=true/);
    assert.match(text, /phase=before-window-focus .*windowFocused=true/);
    assert.doesNotMatch(text, /phase=\S+-keyboard-failed/);
  }
});

test('both network preparations fail for distinct observed reasons and cannot become successful evidence', () => {
  for (const [phase, id] of [['before', 'b9568cc71ef6d04b63f2b0a48eb21d04'], ['after', 'f19cdf4a9a5f0586554667f8c9a4635e']]) {
    const ui = json(phase + '/local-chat-network-ui.json');
    assert.equal(ui.runId, id); assert.equal(ui.completed, false);
    assert.equal(ui.failedPhase, 'network-preparation'); assert.deepEqual(ui.network, []);
    assert.equal(ui.cellularRequestReleased, true); assert.equal(ui.wifiRequestReleased, true);
    assert.equal(ui.transportSetupVersion, 2);
    assert.throws(() => assertChatNetworkReceipt(ui));
    assert.throws(() => assertInstrumentationPassed(bytes(phase + '/LocalChatNetworkFlowTest-instrumentation.txt').toString(), 1));
    for (const end of ['before', 'after']) {
      const history = json(`${phase}/chat-default-selection-${end}.json`);
      assert.equal(history.runId, id); assert.equal(history.recognizedEventCount, 0);
      assert.equal(history.lastReadiness, null);
    }
  }
  const first = json('before/local-chat-network-ui.json').preparationFailure;
  assert.equal(first.hasDefaultDataSubscription, true); assert.equal(first.cellularDataState, 2);
  assert.deepEqual(first.activeInternetTransports, ['cellular']);
  assert.deepEqual([...first.internetTransports].sort(), ['cellular', 'wifi']);
  const last = json('after/local-chat-network-ui.json').preparationFailure;
  assert.equal(last.hasDefaultDataSubscription, false); assert.equal(last.cellularDataState, 0);
  assert.equal(last.cellularAvailableCallbacks, 0);
  assert.deepEqual(last.activeInternetTransports, ['wifi']); assert.deepEqual(last.internetTransports, ['wifi']);
});

test('original bytes, truthful partial copy and current smoke coverage remain mandatory', () => {
  const hashes = json('artifact-sha256.json'); assert.equal(Object.keys(hashes).length, 27);
  for (const [name, hash] of Object.entries(hashes)) {
    assert.equal(createHash('sha256').update(bytes(name)).digest('hex'), hash, name);
    assert.doesNotMatch(bytes(name).toString(), /AIza[\w-]{20,}|Bearer\s+[\w.-]+|-----BEGIN .*PRIVATE KEY|"password"\s*:/);
  }
  const report = bytes('README.md').toString();
  assert.match(report, /39032094118/); assert.match(report, /39032609510/);
  assert.match(report, /does not prove the new focus wait caused/);
  const flow = content.flows.find((item) => item.id === 'messages');
  assert.equal(flow.status, 'partial'); assert.match(flow.remaining, /Répéter les essais de coupure/);
  assert.match(flow.remaining, /Rejouer le clavier/); assert.match(flow.remaining, /coupures réelles/);
  const keyboard = content.updates.find((item) => item.flow === 'messages' &&
    item.date === '2026-10-17' && item.title === 'Les essais du clavier passent');
  assert(keyboard, 'The dated keyboard result must remain present independently of newer messaging announcements');
  assert.match(keyboard.text, /Les écrans passent le nouvel essai/);
  assert.match(keyboard.text, /La coupure n’a pas été rejouée/);
  assert(content.updates.some((item) => item.flow === 'messages' &&
    item.date === '2026-10-17' && item.title === 'Le nouvel essai bloque au clavier'));
  const workflow = readFileSync(new URL('../.github/workflows/web-integration-smoke.yml', import.meta.url), 'utf8');
  for (const path of ['tests/input-readiness-evidence.test.mjs', base + '**']) assert.equal(workflow.split('"' + path + '"').length - 1, 2);
  assert(workflow.includes('run: node --test tests/input-readiness-evidence.test.mjs'));
});

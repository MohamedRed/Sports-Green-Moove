import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { XMLParser } from 'fast-xml-parser';
import { captures } from '../partner-portal/content.mjs';

const root = new URL('../', import.meta.url);
const base = 'docs/release/evidence/local-dual-transport-2026-10-17/';
const bytes = (name) => readFileSync(new URL(base + name, root));
const json = (name) => JSON.parse(bytes(name));

test('the actual latest preparation failure has healthy cellular but no Wi-Fi connection', () => {
  const run = json('before/local-chat-network-ui.json');
  assert.equal(run.runId, '06c381463bccc56a41689db4cd82c01a');
  assert.equal(run.projectId, 'demo-sgm-local-qa'); assert.equal(run.completed, false);
  assert.equal(run.failedPhase, 'network-preparation'); assert.deepEqual(run.network, []);
  assert.equal(run.cellularRequestReleased, true);
  for (const state of [run.preparation, run.preparationFailure]) {
    for (const key of ['wifiEnabled', 'mobileDataEnabled', 'activeNetwork', 'backendReachable', 'hasDefaultDataSubscription']) assert.equal(state[key], true, key);
    assert.equal(state.simState, 5); assert.equal(state.cellularDataState, 2);
    assert.equal(state.internetNetworkCount, 1); assert.deepEqual(state.internetTransports, ['cellular']);
    assert.deepEqual(state.activeInternetTransports, ['cellular']);
  }
  assert.equal(run.preparationFailure.cellularAvailableCallbacks, 1);
  const subscriptions = json('before/chat-subscriptions-before.json');
  assert.equal(subscriptions.runId, run.runId); assert.equal(subscriptions.mappedSlotCount, 1);
  assert.equal(subscriptions.allSubscriptionsLoaded, true); assert.equal(subscriptions.defaultSubscriptionValid.defaultDataSubId, true);
  assert.deepEqual(subscriptions.simStates, ['LOADED']);
  const modem = json('before/chat-modem-before.json'); assert.equal(modem.voice, 'home'); assert.equal(modem.data, 'home');
  const history = json('before/chat-default-selection-before.json');
  assert.equal(history.lastReadiness, null); assert.deepEqual(history.events, []);
});

test('passing component cases cannot promote the later failed full native replay', () => {
  const suite = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '', parseAttributeValue: true,
    isArray: (name) => name === 'testcase' }).parse(bytes('before/general-ui.xml')).testsuite;
  assert.equal(suite.tests, 95); assert.equal(suite.failures, 0); assert.equal(suite.errors, 0); assert.equal(suite.skipped, 19);
  const cases = suite.testcase.filter((item) => ['be.sportgreenmoove.app.ui.TripChangeFlowTest',
    'be.sportgreenmoove.app.ui.TripCancellationFlowTest'].includes(item.classname));
  assert.equal(cases.length, 10);
  assert(cases.every((item) => !Object.hasOwn(item, 'failure') && !Object.hasOwn(item, 'skipped')));
  const transcript = bytes('before/LocalChatNetworkFlowTest-instrumentation.txt').toString('utf8');
  assert.match(transcript, /after 30000 ms/); assert.match(transcript, /LocalChatNetworkFlowTest.kt:75/);
  assert.match(transcript, /Tests run: 1,\s+Failures: 1/);
  assert(!Object.values(captures).some((path) => path.startsWith(base)));
});

test('failure artifacts retain their original bytes and stay in smoke coverage', () => {
  const hashes = json('artifact-sha256.json'); assert.equal(Object.keys(hashes).length, 7);
  for (const [name, hash] of Object.entries(hashes)) assert.equal(createHash('sha256').update(bytes(name)).digest('hex'), hash, name);
  const workflow = readFileSync(new URL('.github/workflows/web-integration-smoke.yml', root), 'utf8');
  assert.equal(workflow.split('"tests/dual-transport-evidence.test.mjs"').length - 1, 2);
  assert(workflow.includes('run: node --test tests/dual-transport-config.test.mjs tests/dual-transport-evidence.test.mjs'));
  const attributes = readFileSync(new URL('.gitattributes', root), 'utf8');
  assert(attributes.includes(base + '**/*.xml -text -whitespace'));
  assert(attributes.includes(base + '**/*.txt -text -whitespace'));
});

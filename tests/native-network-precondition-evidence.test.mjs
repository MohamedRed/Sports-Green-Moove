import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { XMLParser } from 'fast-xml-parser';
import { content } from '../partner-portal/content.mjs';

const base = 'docs/release/evidence/native-network-precondition-2026-10-19/';
const bytes = (path) => readFileSync(new URL('../' + path, import.meta.url));
const json = (file) => JSON.parse(bytes(base + file));

test('the failed native run retains original artifacts and its dated source bindings', () => {
  const hashes = json('artifact-sha256.json');
  assert.equal(Object.keys(hashes).length, 17);
  for (const [file, expected] of Object.entries(hashes))
    assert.equal(createHash('sha256').update(bytes(base + file)).digest('hex'), expected, file);
  const sources = json('source-sha256.json'); assert.equal(Object.keys(sources).length, 7);
  for (const hash of Object.values(sources)) assert.match(hash, /^[a-f0-9]{64}$/);
});

test('ordinary and component success remain separate from the failed full replay', () => {
  const suite = new XMLParser({ ignoreAttributes: false }).parse(bytes(base + 'ordinary-suite.xml')).testsuite;
  assert.equal(suite['@_tests'], '144'); assert.equal(suite['@_failures'], '0'); assert.equal(suite['@_errors'], '0');
  assert.equal(suite['@_skipped'], '34');
  assert.equal(suite.testcase.filter((item) => !('skipped' in item)).length, 110);
  const status = json('native-suite-status.json');
  assert.equal(status.ordinaryTests, 0); assert.equal(status.componentEvidence, 0); assert.equal(status.localReplay, 1);
});

test('temporary device administration is removed after this failing replay without losing maps or location', () => {
  assert.equal(json('disposable-installations-verified.json').installationsBlocked, true);
  const setup = json('disposable-device-setup.json'), cleanup = json('disposable-store-restore.json');
  assert.equal(cleanup.restored, true); assert.equal(cleanup.verified, true);
  assert.deepEqual(cleanup.installAdmin, { authorizationRemoved: true, componentRemoved: true, originalPolicyRestored: true });
  assert.deepEqual(cleanup.observed.mapsRuntime, setup.mapsRuntime);
  assert.equal(cleanup.observed.locationEnabled, true); assert.equal(cleanup.observed.installationsBlocked, true);
});

test('the empty failed network sequence and cleanup transfer are never accepted as a completed handover', () => {
  const report = json('local-chat-network-ui.json');
  assert.equal(report.completed, false); assert.deepEqual(report.network, []);
  assert.equal(report.cellularRequestReleased, null); assert.equal(report.wifiRequestReleased, null);
  const transcript = bytes(base + 'LocalChatNetworkFlowTest-instrumentation.txt').toString('utf8');
  assert.match(transcript, /requires both test radios enabled/); assert.match(transcript, /Tests run: 1,  Failures: 1/);
  const pull = json('adb-pull-failure-cleanup.json');
  assert.equal(pull.phase, 'failure-cleanup'); assert.equal(pull.completed, true); assert.equal(pull.runId, report.runId);
});

test('registered modem state does not establish a usable SIM or default data subscription', () => {
  for (const phase of ['before', 'after']) {
    const modem = json(`chat-modem-${phase}.json`), sim = json(`chat-subscriptions-${phase}.json`);
    assert.equal(modem.voice, 'home'); assert.equal(modem.data, 'home');
    assert.equal(sim.allSubscriptionsLoaded, false); assert.equal(sim.mappedSlotCount, 0);
    assert.equal(sim.defaultSubscriptionValid.defaultDataSubId, false); assert.equal(sim.defaultSubscriptionValid.activeDataSubId, false);
    assert.deepEqual(sim.simStates, ['UNKNOWN']);
  }
});

test('the portal preserves the failed matrix behind the later pass without changing the phone proof', () => {
  assert.equal(content.blockers.find((item) => item.id === 'test-device-stability').source,
    'docs/release/evidence/child-contact-heading-pass-2026-10-19/README.md');
  assert.equal(content.blockers.find((item) => item.id === 'chat-send-stability').source,
    'docs/release/evidence/child-contact-heading-pass-2026-10-19/README.md');
  assert.match(bytes('docs/release/evidence/native-matrix-36-2026-10-19/README.md').toString('utf8'), /native-network-precondition-2026-10-19/);
  assert.equal(content.flows.find((item) => item.id === 'team-enrollment').phone.source,
    'docs/release/evidence/phone-team-enrollment-2026-10-19/results.json');
  for (const name of ['backend-ci.yml', 'web-integration-smoke.yml'])
    assert(bytes('.github/workflows/' + name).toString('utf8').includes('tests/native-network-precondition-evidence.test.mjs'));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { XMLParser } from 'fast-xml-parser';
import { assertInstrumentationPassed } from '../scripts/qa/android-instrumentation-result.mjs';
import { assertChatNetworkReceipt, assertTransportRequestSetup } from '../scripts/qa/chat-network-evidence.mjs';
import { assertChatLossReceipt } from '../scripts/qa/chat-loss-evidence.mjs';
import { assertChatRestartReceipt } from '../scripts/qa/chat-restart-evidence.mjs';
import { assertBookingUiLoss } from '../scripts/qa/booking-ui-loss-evidence.mjs';
import { content, captures } from '../partner-portal/content.mjs';

const base = 'docs/release/evidence/local-dual-transport-2026-10-17/';
const url = new URL('../' + base + 'completed/', import.meta.url);
const bytes = (name) => readFileSync(new URL(name.split('/').map(encodeURIComponent).join('/'), url));
const json = (name) => JSON.parse(bytes(name));
const runId = 'ff75301b1aaf2f96a48b464854dbc1d8';

test('all 24 actual native/backend cases passed independently of the 99-case ordinary suite', () => {
  const run = json('results.json');
  assert.equal(run.projectId, 'demo-sgm-local-qa'); assert.equal(run.runId, runId);
  assert.equal(run.scope, 'local-ui-not-physical-device'); assert.equal(run.testedAt, '2026-10-17T11:56:26.968Z');
  assert.equal(run.testCount, 24); assert.equal(run.steps.length, 24);
  assert.equal(new Set(run.steps.map((item) => item.id)).size, 24);
  assert(run.steps.every((item) => item.status === 'passed'));
  const transcripts = Object.keys(json('artifact-sha256.json')).filter((name) => name.endsWith('-instrumentation.txt'));
  assert.equal(transcripts.length, 16);
  let count = 0;
  for (const name of transcripts) {
    const expected = name.startsWith('LocalAppFlowTest-') ? 9 : 1;
    assertInstrumentationPassed(bytes(name).toString(), expected); count += expected;
  }
  assert.equal(count, 24);
  const suite = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '', parseAttributeValue: true,
    isArray: (name) => name === 'testcase' }).parse(bytes('general-ui.xml')).testsuite;
  assert.equal(suite.tests, 99); assert.equal(suite.failures, 0); assert.equal(suite.errors, 0); assert.equal(suite.skipped, 19);
  const cases = suite.testcase.filter((item) => /\.(LocalInitialNetworkObservationTest|LocalNetworkCleanupTest|TripChangeFlowTest|TripCancellationFlowTest)$/.test(item.classname));
  assert.equal(cases.length, 14);
  assert(cases.every((item) => !Object.hasOwn(item, 'failure') && !Object.hasOwn(item, 'skipped')));
});

test('strict version-2 observations, request release and saved messages all remain mandatory', () => {
  const network = json('local-chat-network-ui.json'), run = json('results.json');
  assert.equal(network.runId, runId); assertChatNetworkReceipt(network); assertTransportRequestSetup(network);
  assert.equal(network.network[0].internetNetworkCount, 2); assert.equal(network.network.at(-1).internetNetworkCount, 2);
  assert.equal(run.chatNetwork.messageCount, 2); assert.equal(run.chatNetwork.notificationCount, 2);
  assert.equal(run.chatNetwork.duplicateMessages, 0);
  assertChatLossReceipt(json('local-chat-loss-ui.json'), json('local-chat-loss-proxy.json'), runId, run.chatResponseLoss.sourceId);
  assertChatRestartReceipt(json('local-chat-restart-before.json'), json('local-chat-restart-stop.json'), json('local-chat-restart-after.json'), runId);
  assertBookingUiLoss(json('booking-ui-loss.json'), runId);
  assert.deepEqual(run.bookingUiResponseLoss, json('booking-ui-loss.json'));
  for (const phase of ['booking-response-loss', 'booking-ui-response-loss', 'confirmed-restart', 'response-loss', 'network-recovery']) {
    const receipt = json(`adb-pull-${phase}.json`);
    assert.equal(receipt.runId, runId); assert.equal(receipt.status, 0); assert.equal(receipt.completed, true);
  }
});

test('reviewed captures use this run while physical, stability and draft-restart scope stays open', () => {
  const flow = content.flows.find((item) => item.id === 'messages');
  assert.equal(flow.status, 'partial'); assert.equal(flow.checkedAt, '2026-10-17');
  assert.equal(flow.source, base + 'README.md'); assert.equal(flow.ui.source, base + 'completed/results.json');
  for (const [id, name] of [['chat-network-current-draft', 'local-chat-network-unconfirmed.png'],
    ['chat-network-current-reply', 'local-chat-network-received.png']]) {
    assert.equal(captures[id], base + 'completed/' + name);
    assert(flow.images.some((item) => item.file === id && item.alt.includes('17 octobre')));
    const png = bytes(name); assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.equal(png.readUInt32BE(16), 1080); assert.equal(png.readUInt32BE(20), 2400);
  }
  for (const remaining of [/Répéter/, /brouillons après fermeture/, /téléphones/, /groupes/, /Pas encore en ligne/]) assert.match(flow.remaining, remaining);
  assert(content.blockers.some((item) => item.id === 'chat-send-stability' && /précédents/.test(item.text)));
  assert(content.updates.some((item) => item.title === 'La coupure et la reprise passent'));
  assert.equal(content.flows.find((item) => item.id === 'tracking').status, 'untested');
});

test('all successful raw artifacts retain original bytes and explicit smoke coverage', () => {
  const hashes = json('artifact-sha256.json'); assert.equal(Object.keys(hashes).length, 47);
  for (const [name, hash] of Object.entries(hashes)) {
    assert.equal(createHash('sha256').update(bytes(name)).digest('hex'), hash, name);
    if (!name.endsWith('.png')) assert(!/AIza[\w-]{20,}|-----BEGIN .*PRIVATE KEY|Bearer\s+[\w.-]+|"password"\s*:/.test(bytes(name).toString()));
  }
  const workflow = readFileSync(new URL('../.github/workflows/web-integration-smoke.yml', import.meta.url), 'utf8');
  assert.equal(workflow.split('"tests/dual-transport-completed-evidence.test.mjs"').length - 1, 2);
  assert(workflow.includes('tests/dual-transport-evidence.test.mjs tests/dual-transport-completed-evidence.test.mjs'));
});

test('the repeat keyboard failure is retained without replacing the completed replay', () => {
  const raw = readFileSync(new URL('../' + base + 'repeat/general-ui.xml', import.meta.url));
  assert.equal(createHash('sha256').update(raw).digest('hex'),
    '51576920b33737c7054adc39542350a427c3dae0e796c145dee939d1f9f773bf');
  const suite = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '', parseAttributeValue: true,
    isArray: (name) => name === 'testcase' }).parse(raw).testsuite;
  assert.equal(suite.tests, 99); assert.equal(suite.failures, 7);
  assert.equal(suite.errors, 0); assert.equal(suite.skipped, 19);
  const failures = suite.testcase.filter((item) => Object.hasOwn(item, 'failure'));
  assert.equal(failures.length, 7);
  for (const item of failures) {
    assert.match(item.failure, /ComposeTimeoutException/);
    assert.match(item.failure, /ConversationTestInteractions\.awaitKeyboard|TripFormTestInputKt\.enterTripFormText/);
  }
  const flow = content.flows.find((item) => item.id === 'messages');
  assert.match(flow.summary, /clavier/); assert.match(flow.remaining, /clavier/);
  assert.equal(flow.ui.source, base + 'completed/results.json');
  assert(content.updates.some((item) => item.title === 'Le nouvel essai bloque au clavier'));
  const report = readFileSync(new URL('../' + base + 'README.md', import.meta.url), 'utf8');
  assert.match(report, /39031056051/); assert.match(report, /replay did not start/);
});

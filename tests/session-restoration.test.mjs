import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { XMLParser } from 'fast-xml-parser';
import { assertChatNetworkReceipt, assertCellularRequestSetup } from '../scripts/qa/chat-network-evidence.mjs';
import { assertChatRestartInteractionReceipt } from '../scripts/qa/chat-restart-evidence.mjs';
import { assertChatLossReceipt } from '../scripts/qa/chat-loss-evidence.mjs';
import { assertInstrumentationPassed } from '../scripts/qa/android-instrumentation-result.mjs';
import { content } from '../partner-portal/content.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const ui = 'android/app/src/main/java/be/sportgreenmoove/app/ui/';

test('startup failures are gated before onboarding and cannot silently become signed-out sessions', () => {
  const app = read(ui + 'SportsGreenMooveApp.kt'), state = read(ui + 'SessionRestorationState.kt');
  assert(!app.includes('session = providers.auth.currentSession()'));
  assert(app.includes('rememberSessionRestoration(providers.auth, providers.isConfigured)'));
  assert(app.indexOf('restoration.phase != SessionRestorationPhase.Ready') < app.indexOf('if (session == null)'));
  assert(app.includes('SessionRestorationScreen(restoration, ::logout)'));
  assert(app.includes('onLogout = ::logout'));
  assert.equal((app.match(/providers\.auth\.signOut\(\)/g) ?? []).length, 1);
  assert(state.includes('catch (cancelled: CancellationException)'));
  assert(state.includes('currentCoroutineContext().ensureActive()'));
  assert(state.includes('if (closed || phase != SessionRestorationPhase.Pending) return'));
  assert(!/delay\(|repeat\(|while\s*\(|error\.message/.test(state));
  const gate = read(ui + 'SessionRestoration.kt');
  assert(gate.includes('onDispose { state.close() }'));
  assert(gate.includes('LaunchedEffect(state, state.attempt, enabled)'));
  assert(gate.includes('state::retry')); assert(gate.includes('state.disconnect(onDisconnect, accept)'));
  for (const name of ['SportsGreenMooveApp', 'SessionRestorationState', 'SessionRestoration']) {
    assert(read(ui + name + '.kt').split('\n').length < 300, name);
  }
});

test('retained auth-stream failure cannot be promoted by passing state tests or a cleanup copy', () => {
  const base = 'docs/release/evidence/local-session-restoration-2026-10-16/';
  const hashes = JSON.parse(read(base + 'artifact-sha256.json'));
  assert.equal(Object.keys(hashes).length, 3);
  for (const [name, hash] of Object.entries(hashes)) assert.equal(createHash('sha256')
    .update(readFileSync(new URL('../' + base + name, import.meta.url))).digest('hex'), hash);
  assert.match(read(base + 'failed-local-cancellation.txt'), /unexpected end of stream/);
  assert.match(read(base + 'failed-local-cancellation.txt'), /FAILURES!!!/);
  assert.equal(JSON.parse(read(base + 'failure-cleanup.json')).runId, '9c2ab66da0302b7d8bcc65bfde47a028');
  const suite = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '', parseAttributeValue: true })
    .parse(read(base + 'state-unit.xml')).testsuite;
  assert.equal(suite.tests, 8); assert.equal(suite.failures, 0); assert.equal(suite.errors, 0);
  assert.match(read(base + 'README.md'), /underlying transport cause is not established/);
});

test('controlled screen cases and captures are mandatory without replacing the full local replay', () => {
  const test = read('android/app/src/androidTest/java/be/sportgreenmoove/app/ui/SessionRestorationFlowTest.kt');
  for (const value of ['rememberSessionRestoration(auth, true)', 'SessionRestorationScreen(state',
    'assertTrue(delivered.isEmpty())', 'state.phase == SessionRestorationPhase.Ready', 'fontScale',
    'session-restoration-error.png', 'session-restoration-narrow.png']) assert(test.includes(value), value);
  const collection = read('scripts/run-android-ui-tests-and-collect-screenshots.sh');
  assert(collection.includes('adb pull /sdcard/Download/sgm-session-restoration'));
  assert(collection.includes('! -s "$output_dir/sgm-session-restoration/$name"'));
  assert(collection.includes('run-local-android-flows.mjs'));
  for (const name of ['web-integration-smoke', 'native-ci']) {
    assert.equal(read(`.github/workflows/${name}.yml`).split('"tests/session-restoration.test.mjs"').length - 1, 2);
  }
  assert(read('package.json').includes('tests/session-restoration.test.mjs'));
});

test('four executed recovery cases and reviewed captures stay distinct from failed full Native and service checks', () => {
  const base = 'docs/release/evidence/local-session-restoration-2026-10-16/screen-recheck/';
  const hashes = JSON.parse(read(base + 'artifact-sha256.json'));
  assert.equal(Object.keys(hashes).length, 10);
  for (const [name, hash] of Object.entries(hashes)) assert.equal(createHash('sha256')
    .update(readFileSync(new URL('../' + base + name, import.meta.url))).digest('hex'), hash, name);
  const suite = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '', parseAttributeValue: true,
    isArray: (name) => name === 'testcase' }).parse(read(base + 'ordinary-components.xml')).testsuite;
  assert.equal(suite.tests, 77); assert.equal(suite.failures, 0); assert.equal(suite.errors, 0); assert.equal(suite.skipped, 16);
  const cases = suite.testcase.filter((item) => item.classname.endsWith('.SessionRestorationFlowTest'));
  assert.equal(cases.length, 4); assert(cases.every((item) => !item.failure && !Object.hasOwn(item, 'skipped')));
  for (const name of ['session-restoration-error.png', 'session-restoration-narrow.png']) {
    const image = readFileSync(new URL('../' + base + name, import.meta.url));
    assert.equal(image.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.equal(image.readUInt32BE(20), 2400);
  }
  const json = (name) => JSON.parse(read(base + name));
  const runId = 'ae0c13eefc16a49e6692563d0df2921a';
  assertChatRestartInteractionReceipt(json('restart-before.json'), json('restart-stop.json'), json('restart-after.json'), runId);
  assert.equal(json('restart-persisted.json').runId, runId);
  const network = json('network-failed.json'); assert.equal(network.runId, runId);
  assert.equal(network.failedPhase, 'network-preparation'); assert.deepEqual(network.network, []);
  assert.throws(() => assertChatNetworkReceipt(network));
  assert.match(read(base + 'network-failed.txt'), /FAILURES!!!/);
  assert.match(read(base + 'service-failure-excerpt.txt'), /Transaction is invalid or closed/);
  assert.match(read(base + 'service-failure-excerpt.txt'), /23\/24 groups passed/);
  const cancellationFollowup = content.blockers.find((item) => item.id === 'cancellation-race');
  assert(read(cancellationFollowup.source).includes(base + 'README.md'));
  assert.match(content.blockers.find((item) => item.id === 'session-restoration').text, /simulés/);
  assert(!/getSubscriberId|getImei|line1Number/.test(read(ui + 'SessionRestorationState.kt')));
});

test('the subsequent complete replay requires every transcript, strict receipts and saved outcomes without closing the earlier reliability risks', () => {
  const base = 'docs/release/evidence/local-complete-replay-2026-10-17/';
  const json = (name) => JSON.parse(read(base + name));
  const run = json('results.json'), runId = 'a7a5366ace1d3ec71b9385ef4fa55401';
  assert.equal(run.runId, runId); assert.equal(run.testedAt, '2026-10-17T02:11:48.524Z');
  assert.equal(run.scope, 'local-ui-not-physical-device'); assert.equal(run.projectId, 'demo-sgm-local-qa');
  assert.equal(run.testCount, 21); assert.equal(run.steps.length, 22);
  assert.equal(new Set(run.steps.map((step) => step.id)).size, 22);
  assert(run.steps.every((step) => step.status === 'passed'));
  assert.equal(run.search.method, 'component-ui-with-explicit-fake-gateway'); assert.equal(run.search.caseCount, 4);
  const files = readdirSync(resolve(root, base)).filter((name) => name.endsWith('-instrumentation.txt'));
  assert.equal(files.length, 13);
  let total = 0;
  for (const file of files) {
    const count = file.startsWith('LocalAppFlowTest-') ? 9 : 1;
    assertInstrumentationPassed(read(base + file), count); total += count;
  }
  assert.equal(total, 21);
  const ordinary = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '', parseAttributeValue: true })
    .parse(read(base + 'ordinary-components.xml')).testsuite;
  assert.equal(ordinary.tests, 77); assert.equal(ordinary.failures, 0); assert.equal(ordinary.errors, 0); assert.equal(ordinary.skipped, 16);
  assertChatRestartInteractionReceipt(json('local-chat-restart-before.json'), json('local-chat-restart-stop.json'),
    json('local-chat-restart-after.json'), runId);
  const checkpoint = json('local-chat-restart-checkpoint.json'), persisted = json('local-chat-restart-persisted.json');
  assert.equal(persisted.runId, runId); assert.equal(persisted.sourceId, run.chatRestart.sourceId);
  assert.equal(persisted.messages.length, 3); assert(persisted.messages.every((message) => message.read));
  for (const key of ['messageId', 'notificationId', 'clientMessageId']) {
    assert.equal(new Set(persisted.messages.map((message) => message[key])).size, 3);
  }
  const original = persisted.messages.find((message) => message.messageId === checkpoint.messageId);
  assert.equal(original.clientMessageId, checkpoint.clientMessageId); assert.equal(original.createdAtMillis, checkpoint.createdAtMillis);
  const network = json('local-chat-network-ui.json'); assert.equal(network.runId, runId);
  assertChatNetworkReceipt(network); assertCellularRequestSetup(network);
  assert.equal(run.chatNetwork.messageCount, 2); assert.equal(run.chatNetwork.notificationCount, 2);
  assert.equal(run.chatNetwork.duplicateMessages, 0);
  assertChatLossReceipt(json('local-chat-loss-ui.json'), json('local-chat-loss-proxy.json'), runId, run.chatResponseLoss.sourceId);
  assert.equal(run.chatResponseLoss.messageCount, 1); assert.equal(run.chatResponseLoss.notificationCount, 1);
  const versions = new Set();
  for (const phase of ['confirmed-restart', 'response-loss', 'network-recovery']) {
    const copy = json(`adb-pull-${phase}.json`);
    assert.equal(copy.runId, runId); assert.equal(copy.phase, phase); assert.equal(copy.completed, true);
    assert.equal(copy.status, 0); assert.equal(copy.signal, null); assert.equal(copy.errorCode, null);
    assert(Date.parse(copy.recordedAt) <= Date.parse(run.testedAt)); versions.add(copy.version);
  }
  assert.equal(versions.size, 1);
  assert.equal(run.tripCancellation.bookingCount, 2); assert.equal(run.tripCancellation.notificationCount, 1);
  assert.equal(run.tripCancellation.refundPendingCount, 1); assert.equal(run.tripCancellation.seatsAfterCancellation, 3);
  for (const key of ['refundIssued', 'livePayment', 'productionDeployed']) assert.equal(run.tripCancellation[key], false);
  const hashes = json('artifact-sha256.json'); assert.equal(Object.keys(hashes).length, 28);
  for (const [name, hash] of Object.entries(hashes)) assert.equal(createHash('sha256')
    .update(readFileSync(resolve(root, base, name))).digest('hex'), hash, name);
  assert.match(read(base + 'README.md'), /does not explain or resolve/);
  assert.match(read(base + 'README.md'), /no transaction-order root fix/);
  assert.equal(content.lastVerifiedAt, '2026-10-17');
  assert(content.blockers.some((item) => item.id === 'cancellation-race'));
  assert.match(content.blockers.find((item) => item.id === 'chat-send-stability').text, /instable/);
  assert(content.updates.some((item) => item.date === '2026-10-17' && item.title === 'Les échanges reprennent après coupure'));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { XMLParser } from 'fast-xml-parser';
import { assertChatLossReceipt } from '../scripts/qa/chat-loss-evidence.mjs';
import { assertChatRestartReceipt } from '../scripts/qa/chat-restart-evidence.mjs';
import { assertChatNetworkReceipt, assertCellularRequestSetup } from '../scripts/qa/chat-network-evidence.mjs';
import { assertInstrumentationPassed } from '../scripts/qa/android-instrumentation-result.mjs';
import { content, captures } from '../partner-portal/content.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const directory = 'docs/release/evidence/local-ui-collection-2026-10-16/';
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const json = (path) => JSON.parse(read(directory + 'accepted-run/' + path));
const run = json('results.json');

test('the completed local replay retains all instrumentation, verified groups and explicit non-physical scopes', () => {
  assert.equal(run.runId, 'ae951a8d5861e55da4e444dbfc751e8f'); assert.equal(run.testedAt, '2026-10-16T16:15:50.682Z');
  assert.equal(run.projectId, 'demo-sgm-local-qa'); assert.equal(run.scope, 'local-ui-not-physical-device');
  assert.equal(run.testCount, 20); assert.equal(run.steps.length, 21); assert(run.steps.every((step) => step.status === 'passed'));
  assert.equal(run.search.method, 'component-ui-with-explicit-fake-gateway'); assert.equal(run.search.caseCount, 4);
  const files = readdirSync(resolve(root, directory, 'accepted-run')).filter((name) => name.endsWith('-instrumentation.txt'));
  assert.equal(files.length, 12);
  let total = 0;
  for (const file of files) {
    const expected = file.startsWith('LocalAppFlowTest-') ? 9 : 1;
    assertInstrumentationPassed(read(directory + 'accepted-run/' + file), expected); total += expected;
  }
  assert.equal(total, 20);
});

test('copy receipts require actual successful status and consistent same-run version metadata, not only transfer summaries', () => {
  const versions = new Set();
  for (const phase of ['confirmed-restart', 'response-loss', 'network-recovery']) {
    const copy = json('adb-pull-' + phase + '.json');
    assert.equal(copy.runId, run.runId); assert.equal(copy.projectId, run.projectId); assert.equal(copy.phase, phase);
    assert.equal(copy.scope, 'local-adb-file-sync-command-not-flow-verification');
    assert.equal(copy.completed, true); assert.equal(copy.status, 0); assert.equal(copy.signal, null); assert.equal(copy.errorCode, null);
    assert.equal(copy.serial, 'emulator-5554'); assert.match(copy.version, /Version 37\.0\.1-15733141/); versions.add(copy.version);
    assert.match(copy.stderr, /service: sync:/); assert.match(copy.stderr, /\d+ files pulled, 0 skipped/);
    assert(Date.parse(copy.recordedAt) <= Date.parse(run.testedAt));
  }
  assert.equal(versions.size, 1);
  assert.equal(existsSync(resolve(root, directory, 'accepted-run/adb-pull-failure-cleanup.json')), false);
});

test('the replay includes independent saved-data results for reply loss, OS recovery and confirmed process restart', () => {
  const original = assertChatLossReceipt(json('local-chat-loss-ui.json'), json('local-chat-loss-proxy.json'), run.runId, run.chatResponseLoss.sourceId);
  for (const key of ['messageId', 'notificationId', 'clientMessageId']) assert.equal(run.chatResponseLoss[key], original[key]);
  assert.equal(run.chatResponseLoss.messageCount, 1); assert.equal(run.chatResponseLoss.notificationCount, 1);
  assert.equal(run.chatResponseLoss.duplicateMessages, 0); assert.equal(run.chatResponseLoss.rejectedRetryRetained, true);
  const network = json('local-chat-network-ui.json');
  assertChatNetworkReceipt(network); assertCellularRequestSetup(network); assert.equal(network.runId, run.runId);
  assert.equal(run.chatNetwork.messageCount, 2); assert.equal(run.chatNetwork.notificationCount, 2); assert.equal(run.chatNetwork.duplicateMessages, 0);
  assertChatRestartReceipt(json('local-chat-restart-before.json'), json('local-chat-restart-stop.json'), json('local-chat-restart-after.json'), run.runId);
  const persisted = json('local-chat-restart-persisted.json');
  assert.equal(persisted.runId, run.runId); assert.equal(persisted.messages.length, 3);
  for (const key of ['messageId', 'clientMessageId', 'notificationId']) assert.equal(new Set(persisted.messages.map((item) => item[key])).size, 3);
  assert(persisted.messages.every((item) => item.read === true));
});

test('the ordinary component suite preserves six conversation cases and passes without changing their failure deadline', () => {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '', parseAttributeValue: true,
    processEntities: false, isArray: (name) => name === 'testcase' });
  const before = parser.parse(read(directory + 'component-before.xml')).testsuite;
  const after = parser.parse(read(directory + 'component-after.xml')).testsuite;
  assert.equal(after.tests, 69); assert.equal(after.failures, 0); assert.equal(after.errors, 0); assert.equal(after.skipped, 15);
  const cases = (suite) => suite.testcase.filter((item) => item.classname === 'be.sportgreenmoove.app.ui.ConversationFlowTest');
  assert.equal(cases(after).length, 6);
  assert.deepEqual(cases(after).map((item) => item.name).sort(), cases(before).map((item) => item.name).sort());
  assert(cases(after).every((item) => !item.failure && !Object.hasOwn(item, 'skipped')));
  assert.match(read('android/app/src/androidTest/java/be/sportgreenmoove/app/ui/ConversationFlowTest.kt'), /waitForText\(text: String\) = compose.waitUntil\(5_000\)/);
});

test('the updated portal uses only the completed replay and retains remaining group, phone and draft scope', () => {
  const flow = content.flows.find((item) => item.id === 'messages');
  assert.equal(flow.status, 'partial'); assert.equal(flow.source, 'docs/release/evidence/native-matrix-67ab59c-2026-10-19/README.md');
  assert.equal(flow.ui.source, 'docs/release/evidence/native-matrix-67ab59c-2026-10-19/replay/results.json');
  for (const name of ['confirmed', 'rejected-retry']) assert.equal(captures['chat-loss-' + name], directory + 'accepted-run/local-chat-loss-' + name + '.png');
  assert.match(flow.remaining, /groupes/); assert.match(flow.remaining, /téléphones/); assert.match(flow.remaining, /brouillons après fermeture/);
  assert.match(read(directory + 'README.md'), /One passing run does not establish why/);
  const workflow = read('.github/workflows/web-integration-smoke.yml');
  assert.equal(workflow.split('"tests/ui-collection-evidence.test.mjs"').length - 1, 2);
  assert.match(workflow, /^\s+run: node --test[^\n]*\btests\/ui-collection-evidence\.test\.mjs(?:\s|$)/m);
});

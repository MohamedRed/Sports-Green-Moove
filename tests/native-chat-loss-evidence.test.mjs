import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { assertChatLossReceipt } from '../scripts/qa/chat-loss-evidence.mjs';
import { assertChatRestartReceipt } from '../scripts/qa/chat-restart-evidence.mjs';
import { assertChatNetworkReceipt, assertCellularRequestSetup } from '../scripts/qa/chat-network-evidence.mjs';
import { assertInstrumentationPassed } from '../scripts/qa/android-instrumentation-result.mjs';
import { content, captures } from '../partner-portal/content.mjs';

const directory = 'docs/release/evidence/local-native-chat-loss-2026-10-16/';
const evidenceRoot = fileURLToPath(new URL('../' + directory, import.meta.url));
const read = (name) => readFileSync(resolve(evidenceRoot, name), 'utf8');
const json = (name) => JSON.parse(read(name));
test('retained SDK evidence proves a committed lost reply, rejected retry and unchanged successful recovery', () => {
  const run = json('results.json'), ui = json('local-chat-loss-ui.json'), proxy = json('local-chat-loss-proxy.json');
  assert.equal(run.runId, '7dde06173a7232117e7f4f689af3b9e0');
  assert.equal(run.testedAt, '2026-10-16T13:44:18.049Z');
  assert.equal(run.projectId, 'demo-sgm-local-qa'); assert.equal(run.scope, 'local-ui-not-physical-device');
  assert.equal(run.testCount, 20); assert.equal(run.steps.length, 21);
  assert(run.steps.every((step) => step.status === 'passed'));
  assert(run.steps.some((step) => step.id === 'chat-post-commit-response-loss-ui'));
  const original = assertChatLossReceipt(ui, proxy, run.runId, run.chatResponseLoss.sourceId);
  assert.equal(proxy.attempts.length, 3);
  for (const key of ['messageId', 'clientMessageId', 'notificationId']) assert.equal(run.chatResponseLoss[key], original[key]);
  assert.equal(run.chatResponseLoss.messageCount, 1); assert.equal(run.chatResponseLoss.notificationCount, 1);
  assert.equal(run.chatResponseLoss.duplicateMessages, 0); assert.equal(run.chatResponseLoss.attempts, 3);
  assert.equal(run.chatResponseLoss.rejectedRetryRetained, true); assert.equal(run.chatResponseLoss.networkRestored, true);
  assert(run.chatResponseLoss.limits.some((limit) => limit.includes('not full app navigation')));
  assert(run.chatResponseLoss.limits.some((limit) => limit.includes('No operating-system network loss')));
  assertChatRestartReceipt(json('local-chat-restart-before.json'), json('local-chat-restart-stop.json'),
    json('local-chat-restart-after.json'), run.runId);
  assertChatNetworkReceipt(json('local-chat-network-ui.json')); assertCellularRequestSetup(json('local-chat-network-ui.json'));
  const transcripts = readdirSync(new URL('../' + directory, import.meta.url)).filter((name) => name.endsWith('-instrumentation.txt'));
  assert.equal(transcripts.length, 12);
  let cases = 0;
  for (const name of transcripts) {
    const expected = name.startsWith('LocalAppFlowTest-') ? 9 : 1;
    assertInstrumentationPassed(read(name), expected); cases += expected;
  }
  assert.equal(cases, 20);
});
test('published captures and copy retain controlled local scope and all older evidence', () => {
  const published = 'docs/release/evidence/local-ui-collection-2026-10-16/';
  const flow = content.flows.find((item) => item.id === 'messages');
  assert.equal(flow.status, 'partial'); assert.equal(flow.source, 'docs/release/evidence/local-default-selection-2026-10-17/README.md');
  assert.equal(flow.ui.source, 'docs/release/evidence/local-default-selection-2026-10-17/completed/results.json'); assert(flow.ui.groups.includes('chat-post-commit-response-loss-ui'));
  assert.equal(flow.images[0].file, 'chat-network-current-draft');
  const retained = flow.images.filter((image) => !['chat-restart-recheck-reply', 'chat-network-current-draft', 'chat-network-current-reply'].includes(image.file));
  assert.equal(retained[0].file, 'chat-loss-confirmed'); assert.equal(retained[1].file, 'chat-loss-rejected-retry');
  for (const name of ['confirmed', 'rejected-retry']) {
    assert.equal(captures['chat-loss-' + name], published + 'accepted-run/local-chat-loss-' + name + '.png');
    const png = readFileSync(new URL('../' + captures['chat-loss-' + name], import.meta.url));
    assert.equal(png.readUInt32BE(16), 1080); assert.equal(png.readUInt32BE(20), 2400);
  }
  assert(flow.images.some((image) => image.file === 'chat-restart-reply'));
  assert.match(flow.remaining, /brouillons après fermeture/); assert.match(flow.remaining, /téléphones/);
  assert.match(flow.remaining, /coupures réelles/);
  assert.match(read('README.md'), /not full-app navigation/);
  assert.match(read('README.md'), /No production/);
});

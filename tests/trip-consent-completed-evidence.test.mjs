import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { XMLParser } from 'fast-xml-parser';
import { assertInstrumentationPassed } from '../scripts/qa/android-instrumentation-result.mjs';
import { assertTripChangeUiReceipt } from '../scripts/qa/trip-change-ui-evidence.mjs';
import { assertChatNetworkReceipt, assertTransportRequestSetup } from '../scripts/qa/chat-network-evidence.mjs';
import { assertChatLossReceipt } from '../scripts/qa/chat-loss-evidence.mjs';
import { assertChatRestartReceipt } from '../scripts/qa/chat-restart-evidence.mjs';
import { content, captures } from '../partner-portal/content.mjs';

const base = 'docs/release/evidence/local-trip-consent-native-2026-10-17/';
const url = new URL('../' + base + 'completed/', import.meta.url);
const bytes = (name) => readFileSync(new URL(name.split('/').map(encodeURIComponent).join('/'), url));
const json = (name) => JSON.parse(bytes(name));
const runId = 'eb2b795695b03cb8ceb0dc85c609a6ce';

test('the actual complete native replay requires all 25 groups and all 17 successful transcripts', () => {
  const run = json('results.json');
  assert.equal(run.runId, runId); assert.equal(run.projectId, 'demo-sgm-local-qa');
  assert.equal(run.scope, 'local-ui-not-physical-device'); assert.equal(run.testedAt, '2026-10-17T15:27:17.368Z');
  assert.equal(run.testCount, 25); assert.equal(run.steps.length, 25);
  assert.equal(new Set(run.steps.map((item) => item.id)).size, 25);
  assert(run.steps.every((item) => item.status === 'passed'));
  const transcripts = Object.keys(json('artifact-sha256.json')).filter((name) => name.endsWith('-instrumentation.txt'));
  assert.equal(transcripts.length, 17);
  for (const name of transcripts) assertInstrumentationPassed(bytes(name).toString(), name.startsWith('LocalAppFlowTest-') ? 9 : 1);
  const suite = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '', parseAttributeValue: true,
    isArray: (name) => name === 'testcase' }).parse(bytes('general-ui.xml')).testsuite;
  assert.equal(suite.tests, 102); assert.equal(suite.failures, 0); assert.equal(suite.errors, 0); assert.equal(suite.skipped, 20);
  assert.deepEqual(json('native-suite-status.json'), { scope: 'native-suite-exit-status-not-flow-verification',
    ordinaryTests: 0, componentEvidence: 0, localReplay: 0 });
});

test('the accepted consent stage requires native decisions plus independent saved-data checks', () => {
  const stage = json('trip-change-ui-stage.json'), run = json('results.json');
  assert.equal(stage.runId, runId); assert.equal(stage.testCount, 1);
  assert.equal(stage.recordType, 'native-trip-change-stage-not-full-run-result');
  assert.equal(stage.method, 'native-app-three-account-ui-with-independent-persisted-checks');
  assert.deepEqual(stage, run.tripChanges);
  assert.equal(stage.records.length, 3);
  assert.deepEqual(stage.records.map((item) => item.status), ['confirmed', 'declined', 'withdrawn']);
  assert.deepEqual(stage.records.map((item) => item.decisionCount), [2, 1, 0]);
  for (const item of stage.records) {
    assert.equal(item.parentCount, 2); assert.equal(item.bookingCount, 2); assert.equal(item.notificationCount, 5);
    assert.equal(item.originalPriceCents, 250); assert.equal(item.proposedPriceCents, 400);
  }
  const fixtures = Object.fromEntries(stage.records.map((item) => [item.status, { tripId: item.tripId }]));
  assertTripChangeUiReceipt(json('local-trip-change-ui.json'), { fixtures, runId });
  for (const key of ['tripAndBookingsUnchanged', 'parentViewsScoped', 'outsiderDenied', 'unappliedTripStartDenied']) assert.equal(stage[key], true);
  for (const key of ['applicationExercised', 'routeProviderExercised', 'paymentExercised', 'fullAppReplay']) assert.equal(stage[key], false);
});

test('parent consent cannot replace strict offline, handover, response-loss and process-restart proof', () => {
  const run = json('results.json'), network = json('local-chat-network-ui.json');
  assert.equal(network.runId, runId); assertChatNetworkReceipt(network); assertTransportRequestSetup(network);
  assert.equal(run.chatNetwork.messageCount, 2); assert.equal(run.chatNetwork.notificationCount, 2);
  assert.equal(run.chatNetwork.duplicateMessages, 0);
  assertChatLossReceipt(json('local-chat-loss-ui.json'), json('local-chat-loss-proxy.json'), runId, run.chatResponseLoss.sourceId);
  assertChatRestartReceipt(json('local-chat-restart-before.json'), json('local-chat-restart-stop.json'), json('local-chat-restart-after.json'), runId);
  for (const phase of ['booking-response-loss', 'booking-ui-response-loss', 'confirmed-restart', 'response-loss', 'network-recovery', 'trip-change-parent-confirmation']) {
    const receipt = json(`adb-pull-${phase}.json`);
    assert.equal(receipt.runId, runId); assert.equal(receipt.status, 0); assert.equal(receipt.completed, true);
  }
});

test('reviewed local consent images are backed by completion and cannot promote map or phone readiness', () => {
  const flow = content.flows.find((item) => item.id === 'publication');
  assert.equal(flow.status, 'partial'); assert.equal(flow.ui.source, 'docs/release/evidence/local-trip-history-2026-10-18/completed-native/results.json');
  assert.deepEqual(flow.ui.groups, ['driver-trip-cancellation-ui', 'trip-change-parent-confirmation-ui', 'trip-change-inputs-ui', 'trip-change-schedule-ui', 'trip-consent-process-restart-ui', 'trip-consent-pending-restart-ui', 'trip-consent-partial-restart-ui', 'trip-consent-declined-restart-ui', 'trip-consent-withdrawn-restart-ui']);
  assert.match(flow.verified, /Deux parents/);
  assert.match(flow.remaining, /paiements et remboursements réels/);
  const images = [['trip-consent-first', 'first-parent'], ['trip-consent-confirmed', 'both-parents'],
    ['trip-consent-refused', 'parent-refused'], ['trip-consent-withdrawn', 'withdrawn']];
  for (const [id, name] of images) {
    const path = `local-trip-change-${name}.png`, png = bytes(path);
    assert.equal(captures[id], base + 'completed/' + path);
    assert(flow.images.some((item) => item.file === id && item.alt.includes('17 octobre')));
    assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.equal(png.readUInt32BE(16), 1080); assert.equal(png.readUInt32BE(20), 2140);
  }
  assert.equal(content.flows.find((item) => item.id === 'tracking').status, 'untested');
});

test('original complete artifacts and mandatory smoke coverage preserve failed historical evidence', () => {
  const hashes = json('artifact-sha256.json'); assert.equal(Object.keys(hashes).length, 54);
  for (const [name, hash] of Object.entries(hashes)) {
    assert.equal(createHash('sha256').update(bytes(name)).digest('hex'), hash, name);
    if (!name.endsWith('.png')) assert(!/AIza[\w-]{20,}|Bearer\s+[\w.-]+|"password"\s*:/.test(bytes(name).toString()));
  }
  const workflow = readFileSync(new URL('../.github/workflows/web-integration-smoke.yml', import.meta.url), 'utf8');
  assert.equal(workflow.split('"tests/trip-consent-completed-evidence.test.mjs"').length - 1, 2);
  assert(workflow.includes('run: node --test tests/trip-consent-completed-evidence.test.mjs'));
  for (const dir of ['before-renderer', 'eligible-runtime', 'process-stopped', 'first-consent-attempt', 'ui-passed-verification-interrupted']) {
    assert(Object.keys(JSON.parse(readFileSync(new URL('../' + base + dir + '/artifact-sha256.json', import.meta.url)))).length > 0);
  }
});

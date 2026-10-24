import test from 'node:test';
import { validateCurrentNativeBlocker } from '../scripts/qa/flow-recheck-evidence.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { XMLParser } from 'fast-xml-parser';
import { assertInstrumentationPassed } from '../scripts/qa/android-instrumentation-result.mjs';
import { assertChatNetworkReceipt, assertTransportRequestSetup } from '../scripts/qa/chat-network-evidence.mjs';
import { assertNetworkStartReceipt } from '../scripts/qa/network-start-evidence.mjs';
import { content } from '../partner-portal/content.mjs';

const base = 'docs/release/evidence/native-matrix-36-2026-10-19/';
const root = fileURLToPath(new URL('../', import.meta.url));
const bytes = (file) => readFileSync(resolve(root, base, file));
const json = (file) => JSON.parse(bytes(file));
const run = json('replay/results.json');
const steps = ['parent-app-ui', 'driver-approval-ui', 'landscape-login-ui', 'calendar-empty-consent-ui',
  'theme-process-restart-ui', 'ride-lifecycle-ui', 'ride-review-ui', 'ride-ledgers-ui', 'chat-conversation-ui',
  'chat-directory-ui', 'search-input-ui', 'search-session-ui', 'search-criteria-ui', 'search-retention-ui',
  'multi-seat-sdk', 'reservation-decisions-ui', 'membership-refresh-ui', 'chat-network-recovery-ui',
  'chat-account-switch-ui', 'chat-confirmed-process-restart-ui', 'chat-post-commit-response-loss-ui',
  'driver-trip-cancellation-ui', 'booking-post-commit-response-loss-sdk', 'booking-response-loss-search-ui',
  'trip-change-parent-confirmation-ui', 'trip-change-inputs-ui', 'trip-change-schedule-ui',
  'trip-consent-process-restart-ui', 'trip-consent-pending-restart-ui', 'trip-consent-partial-restart-ui',
  'trip-consent-declined-restart-ui', 'trip-consent-withdrawn-restart-ui', 'trip-draft-process-restart-ui',
  'guardian-parent-ui', 'emergency-contact-ui', 'team-enrollment-ui'];

test('the completed matrix retains original bytes and the source actually executed before the new observer', () => {
  const hashes = json('artifact-sha256.json'); assert.equal(Object.keys(hashes).length, 109);
  for (const [file, expected] of Object.entries(hashes))
    assert.equal(createHash('sha256').update(bytes(file)).digest('hex'), expected, file);
  const source = json('source-sha256.json'); assert.equal(Object.keys(source).length, 100);
  assert(!Object.keys(source).some((file) => file.endsWith('/LocalNetworkStartObservation.kt')));
  assert.equal(json('summary.json').sourceCommit, '888f618ed71c8b1b061f069a9eb4168aaf7339c6');
});

test('all 36 planned groups and all three exit stages pass without omitting prior coverage', () => {
  assert.equal(run.projectId, 'demo-sgm-local-qa'); assert.equal(run.scope, 'local-ui-not-physical-device');
  assert.equal(run.runId, json('summary.json').runId); assert.equal(run.testCount, 36); assert.equal(run.nativeCaseCount, 38);
  assert.deepEqual(run.steps, steps.map((id) => ({ id, status: 'passed' })));
  const status = json('native-suite-status.json');
  assert.equal(status.ordinaryTests, 0); assert.equal(status.componentEvidence, 0); assert.equal(status.localReplay, 0);
  const suite = new XMLParser({ ignoreAttributes: false }).parse(bytes('ordinary-suite.xml')).testsuite;
  assert.equal(suite['@_tests'], '144'); assert.equal(suite['@_skipped'], '34');
  assert.equal(suite['@_failures'], '0'); assert.equal(suite['@_errors'], '0');
});

test('30 original transcripts prove 38 cases and all 15 transfers are successful primary exports', () => {
  const files = Object.keys(json('artifact-sha256.json'));
  const transcripts = files.filter((file) => file.endsWith('-instrumentation.txt')); assert.equal(transcripts.length, 30);
  let count = 0;
  for (const file of transcripts) {
    const expected = file.startsWith('replay/LocalAppFlowTest-') ? 9 : 1;
    assertInstrumentationPassed(bytes(file).toString('utf8'), expected); count += expected;
  }
  assert.equal(count, 38);
  const pulls = files.filter((file) => file.startsWith('replay/adb-pull-')); assert.equal(pulls.length, 15);
  for (const file of pulls) {
    const pull = json(file); assert.equal(pull.completed, true); assert.equal(pull.status, 0);
    assert.equal(pull.runId, run.runId); assert.notEqual(pull.phase, 'failure-cleanup');
  }
});

test('actual handover and message recovery pass the executed contract but cannot satisfy the later initial-observation contract', () => {
  const network = json('replay/local-chat-network-ui.json');
  assertChatNetworkReceipt(network); assertTransportRequestSetup(network);
  assert.equal(network.runId, run.runId);
  assert.deepEqual(network.network.map((item) => item.phase), ['before', 'cellular-ready', 'offline', 'restored']);
  assert.equal(network.network[0].simState, 5); assert.equal(network.network[0].hasDefaultDataSubscription, true);
  assert.equal(run.chatNetwork.messageCount, 2); assert.equal(run.chatNetwork.duplicateMessages, 0);
  assert.throws(() => assertNetworkStartReceipt(network));
});

test('administration cleanup and the original maps and location invariants pass without accepting release requirements', () => {
  const cleanup = json('disposable-store-restore.json'), setup = json('disposable-device-setup.json');
  assert.equal(cleanup.restored, true); assert.equal(cleanup.verified, true);
  assert.deepEqual(cleanup.installAdmin, { authorizationRemoved: true, componentRemoved: true, originalPolicyRestored: true });
  assert.deepEqual(cleanup.observed.mapsRuntime, setup.mapsRuntime); assert.equal(cleanup.observed.locationEnabled, true);
  assert.equal(json('disposable-installations-verified.json').installationsBlocked, true);
  const summary = json('summary.json');
  for (const key of ['physicalDevice', 'livePayments', 'productionDeployed', 'newInitialObservationExecuted']) assert.equal(summary[key], false);
});

test('the portal keeps reliability and physical limits open while publishing this completed local matrix', () => {
  validateCurrentNativeBlocker(root, content);
  assert.equal(content.blockers.find((item) => item.id === 'chat-send-stability').source,
    content.nativeVerification.source);
  assert.equal(content.flows.find((item) => item.id === 'tracking').status, 'untested');
  assert.equal(content.flows.find((item) => item.id === 'messages').status, 'partial');
  assert(content.updates.some((item) => item.title === 'L’essai local complet passe'));
});

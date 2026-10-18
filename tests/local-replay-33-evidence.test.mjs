import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { XMLParser } from 'fast-xml-parser';
import { assertInstrumentationPassed } from '../scripts/qa/android-instrumentation-result.mjs';
import { assertChatNetworkReceipt, assertTransportRequestSetup } from '../scripts/qa/chat-network-evidence.mjs';
import { assertTripDraftRestart } from '../scripts/qa/trip-draft-restart-evidence.mjs';
import { content } from '../partner-portal/content.mjs';

const base = 'docs/release/evidence/local-replay-33-2026-10-18/';
const bytes = (path) => readFileSync(new URL('../' + path.split('/').map(encodeURIComponent).join('/'), import.meta.url));
const text = (path) => bytes(path).toString('utf8');
const json = (name) => JSON.parse(text(base + 'originals/' + name));

test('all 33 actual local groups pass while original reports and separate runtime failure remain intact', () => {
  const hashes = json('artifact-sha256.json'); assert.equal(Object.keys(hashes).length, 85);
  for (const [name, hash] of Object.entries(hashes)) {
    const raw = bytes(base + 'originals/' + name);
    assert.equal(createHash('sha256').update(raw).digest('hex'), hash, name);
    assert.doesNotMatch(raw.toString(), /AIza[\w-]{20,}|Bearer\s+[\w.-]+|"password"\s*:/);
  }
  const run = json('results.json');
  assert.equal(run.projectId, 'demo-sgm-local-qa'); assert.equal(run.runId, 'e4d6f943e6f1663e6881db88a72d344c');
  assert.equal(run.testedAt, '2026-10-18T02:12:02.122Z'); assert.equal(run.scope, 'local-ui-not-physical-device');
  assert.equal(run.testCount, 33); assert.equal(run.steps.length, 33); assert(run.steps.every((s) => s.status === 'passed'));
  assert.equal(new Set(run.steps.map((s) => s.id)).size, 33);
  const transcripts = Object.keys(hashes).filter((n) => n.endsWith('-instrumentation.txt'));
  assert.equal(transcripts.length, 25);
  for (const name of transcripts)
    assertInstrumentationPassed(text(base + 'originals/' + name), name.startsWith('LocalAppFlowTest-') ? 9 : 1);
  const copies = Object.keys(hashes).filter((n) => n.startsWith('adb-pull-')); assert.equal(copies.length, 11);
  for (const name of copies) { assert.equal(json(name).runId, run.runId); assert.equal(json(name).completed, true); }
  const suite = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '', parseAttributeValue: true,
    isArray: (name) => name === 'testcase' }).parse(text(base + 'originals/general-ui.xml')).testsuite;
  assert.equal(suite.tests, 116); assert.equal(suite.skipped, 28); assert.equal(suite.failures, 0); assert.equal(suite.errors, 0);
  const drafts = suite.testcase.filter((c) => c.classname.endsWith('.TripDraftPersistenceFlowTest'));
  assert.equal(drafts.length, 3); assert(drafts.every((c) => !Object.hasOwn(c, 'skipped')));
  assert.deepEqual(json('native-suite-status.json'), {
    scope: 'native-suite-exit-status-not-flow-verification', ordinaryTests: 0, componentEvidence: 0, localReplay: 0,
  });
  const setup = json('disposable-device-setup.json'), cleanup = json('disposable-store-restore.json');
  assert.equal(setup.storePause.method, 'restricted-store-background');
  assert.equal(setup.storePause.mapsRuntime.playServicesVersion, '24.23.35');
  assert.equal(cleanup.method, 'restricted-store-background'); assert.equal(cleanup.restored, true);
  assert.equal(cleanup.verified, false); assert.equal(cleanup.observed.locationEnabled, true);
  assert.equal(cleanup.observed.noActiveStoreInstall, true);
  assert.deepEqual(cleanup.observed.background, { RUN_IN_BACKGROUND: 'ignore', RUN_ANY_IN_BACKGROUND: 'deny' });
  assert(!Object.hasOwn(cleanup.observed, 'mapsRuntime'));
  const failure = text(base + 'originals/store-runtime-mismatch.txt');
  assert.match(failure, /Maps runtime changed during the test/);
  assert.match(failure, /26\.40\.32/); assert.match(failure, /24\.23\.35/);
});

test('the successful network and draft receipts retain strict observations rather than repairing earlier failures', () => {
  const run = json('results.json'), network = json('local-chat-network-ui.json');
  assert.equal(network.runId, run.runId); assertChatNetworkReceipt(network); assertTransportRequestSetup(network);
  for (const phase of ['before', 'after']) assert.equal(json(`chat-subscriptions-${phase}.json`).defaultSubscriptionValid.defaultDataSubId, true);
  const stage = json('trip-draft-restart-ui-stage.json'); assert.deepEqual(stage, run.tripDraftRestart);
  assertTripDraftRestart(stage.native.before, stage.native.stopped, stage.native.after, stage, run.runId);
  assert.equal(stage.native.before.processId, 10953); assert.equal(stage.native.after.processId, 11097);
  assert.equal(stage.native.stopped.observedBeforePid, null);
  assert.equal(stage.recordsUnchanged, true); assert.equal(stage.automaticProposalCreated, false);
  for (const field of ['fullAppReplay', 'paymentExercised', 'routeProviderExercised']) assert.equal(stage[field], false);
  const report = text(base + 'README.md');
  for (const required of ['608bc4168c99ff9726aa49c093986b607e0569fd', 'broader CI job remains **failed**',
    'do **not** prove updates stayed', 'No production deployment', 'Previous failures']) assert(report.includes(required), required);
});

test('private updates describe a local pass and keep runtime, physical and payment limitations visible', () => {
  assert(content.updates.some((u) => u.date === '2026-10-18' && u.title === 'Les 33 essais locaux prévus passent'));
  const blocker = content.blockers.find((b) => b.id === 'test-device-stability');
  assert.equal(blocker.source, 'docs/release/evidence/native-input-focus-2026-10-18/README.md');
  assert.match(blocker.next, /conserver les captures/); assert.match(blocker.text, /s’arrête dans l’app/);
  assert.equal(content.flows.find((f) => f.id === 'publication').status, 'partial');
  assert.equal(content.flows.find((f) => f.id === 'tracking').status, 'untested');
  assert.match(content.flows.find((f) => f.id === 'payments').remaining, /paiements réels/);
  const workflow = text('.github/workflows/web-integration-smoke.yml');
  assert.equal(workflow.split('"tests/local-replay-33-evidence.test.mjs"').length - 1, 2);
  assert(workflow.includes('node --test tests/trip-history-evidence.test.mjs tests/local-replay-33-evidence.test.mjs'));
});

test('the actual carrier recheck passes both suites but preserves a second failed runtime verification', () => {
  const prefix = base + 'carrier-recheck/';
  const read = (name) => JSON.parse(text(prefix + name));
  const hashes = read('artifact-sha256.json'); assert.equal(Object.keys(hashes).length, 87);
  for (const [name, hash] of Object.entries(hashes)) {
    const raw = bytes(prefix + name); assert.equal(createHash('sha256').update(raw).digest('hex'), hash, name);
    assert.doesNotMatch(raw.toString(), /AIza[\w-]{20,}|Bearer\s+[\w.-]+|"password"\s*:/);
  }
  const run = read('results.json'); assert.equal(run.runId, '69ac15a98198753c9fb69dfb186a229b');
  assert.equal(run.testedAt, '2026-10-18T02:23:19.872Z'); assert.equal(run.testCount, 33);
  assert.equal(run.steps.length, 33); assert(run.steps.every((s) => s.status === 'passed'));
  const transcripts = Object.keys(hashes).filter((n) => n.endsWith('-instrumentation.txt')); assert.equal(transcripts.length, 25);
  for (const name of transcripts) assertInstrumentationPassed(text(prefix + name), name.startsWith('LocalAppFlowTest-') ? 9 : 1);
  const copies = Object.keys(hashes).filter((n) => n.startsWith('adb-pull-')); assert.equal(copies.length, 11);
  for (const name of copies) { assert.equal(read(name).runId, run.runId); assert.equal(read(name).completed, true); }
  for (const phase of ['before', 'after']) {
    const carrier = read(`chat-carrier-${phase}.json`);
    assert.equal(carrier.runId, run.runId); assert.equal(carrier.phase, phase);
    assert.equal(carrier.source, 'current-carrier-loader-state-not-default-selection-readiness');
    assert.equal(carrier.phoneCount, 1); assert.deepEqual(carrier.configChangeSent, [true]);
    assert.deepEqual(carrier.fromSystemUnlocked, [false]); assert.deepEqual(carrier.serviceBoundForNoSimConfig, [false]);
    assert.equal(read(`chat-subscriptions-${phase}.json`).defaultSubscriptionValid.defaultDataSubId, true);
  }
  const network = read('local-chat-network-ui.json'); assertChatNetworkReceipt(network); assertTransportRequestSetup(network);
  const suite = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '', parseAttributeValue: true })
    .parse(text(prefix + 'general-ui.xml')).testsuite;
  assert.equal(suite.tests, 116); assert.equal(suite.skipped, 28); assert.equal(suite.failures, 0); assert.equal(suite.errors, 0);
  assert.deepEqual(read('native-suite-status.json'), {
    scope: 'native-suite-exit-status-not-flow-verification', ordinaryTests: 0, componentEvidence: 0, localReplay: 0 });
  const cleanup = read('disposable-store-restore.json'); assert.equal(cleanup.restored, true); assert.equal(cleanup.verified, false);
  assert.deepEqual(cleanup.observed.background, { RUN_IN_BACKGROUND: 'ignore', RUN_ANY_IN_BACKGROUND: 'deny' });
  assert.match(text(prefix + 'store-runtime-mismatch.txt'), /Maps runtime changed during the test/);
  assert.match(text(base + 'README.md'), /c3ac91335c97205ea8cb7c5d5da523d89ed4a92c/);
});

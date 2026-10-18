import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { XMLParser } from 'fast-xml-parser';
import { assertInstrumentationPassed } from '../scripts/qa/android-instrumentation-result.mjs';
import { assertTripConsentRestart } from '../scripts/qa/trip-consent-restart-evidence.mjs';
import { content, captures } from '../partner-portal/content.mjs';

const base = 'docs/release/evidence/local-trip-consent-restart-native-2026-10-17/';
const bytes = (path) => readFileSync(new URL('../' + path.split('/').map(encodeURIComponent).join('/'), import.meta.url));
const text = (path) => bytes(path).toString('utf8');
const json = (name) => JSON.parse(text(base + 'completed/' + name));
const runId = '7c07413926f6fe767cbafb38ee5a9654';

test('completed restart evidence preserves 71 original files, 28 groups, 21 transcripts and nine successful copies', () => {
  const hashes = json('artifact-sha256.json'); assert.equal(Object.keys(hashes).length, 71);
  for (const [name, hash] of Object.entries(hashes)) {
    const raw = bytes(base + 'completed/' + name);
    assert.equal(createHash('sha256').update(raw).digest('hex'), hash, name);
    if (!name.endsWith('.png')) assert.doesNotMatch(raw.toString(), /AIza[\w-]{20,}|Bearer\s+[\w.-]+|"password"\s*:/);
  }
  const run = json('results.json'); assert.equal(run.runId, runId); assert.equal(run.projectId, 'demo-sgm-local-qa');
  assert.equal(run.testedAt, '2026-10-17T22:42:57.471Z'); assert.equal(run.scope, 'local-ui-not-physical-device');
  assert.equal(run.testCount, 28); assert.equal(run.steps.length, 28);
  const previous = JSON.parse(text('docs/release/evidence/local-trip-change-schedule-native-2026-10-17/completed/results.json'));
  assert.deepEqual(run.steps.map((s) => s.id).sort(), [...previous.steps.map((s) => s.id), 'trip-consent-process-restart-ui'].sort());
  assert(run.steps.every((s) => s.status === 'passed'));
  const transcripts = Object.keys(hashes).filter((name) => name.endsWith('-instrumentation.txt'));
  assert.equal(transcripts.length, 21);
  for (const name of transcripts) assertInstrumentationPassed(text(base + 'completed/' + name), name.startsWith('LocalAppFlowTest-') ? 9 : 1);
  const copies = Object.keys(hashes).filter((name) => name.startsWith('adb-pull-')); assert.equal(copies.length, 9);
  for (const name of copies) {
    const copy = json(name); assert.equal(copy.runId, runId); assert.equal(copy.completed, true);
    assert.equal(copy.status, 0); assert.equal(copy.signal, null); assert.equal(copy.errorCode, null);
  }
  assert.deepEqual(json('native-suite-status.json'), { scope: 'native-suite-exit-status-not-flow-verification',
    ordinaryTests: 0, componentEvidence: 0, localReplay: 0 });
  assert.deepEqual(run.tripConsentRestart, json('trip-consent-restart-ui-stage.json'));
  for (const extension of ['xml', 'txt']) assert(text('.gitattributes').includes(`${base}**/*.${extension} -text -whitespace`));
});

test('the same saved consent survives the guarded process boundary and both real account views without new writes', () => {
  const stage = json('trip-consent-restart-ui-stage.json'); assert.equal(stage.runId, runId);
  assert.equal(stage.recordType, 'native-trip-consent-restart-stage-not-full-run-result');
  assert.equal(stage.testedAt, '2026-10-17T22:41:31.919Z'); assert.equal(stage.nativeCaseCount, 2);
  const before = json('local-trip-consent-restart-before.json'), after = json('local-trip-consent-restart-after.json');
  const stopped = json('local-trip-consent-restart-stop.json');
  assertTripConsentRestart(before, stopped, after, stage, runId);
  assert.equal(before.processId, 11443); assert.equal(after.processId, 11625);
  assert.deepEqual(stage.native, { before, after, stopped });
  assert.deepEqual(stage.checkpoint, json('trip-consent-restart-checkpoint.json'));
  assert.equal(stage.checkpoint.proposalId, stage.proposalId); assert.equal(stage.persisted.proposalId, stage.proposalId);
  assert.deepEqual(stage.persisted.hashes, stage.checkpoint.hashes);
  for (const key of ['decisionCount', 'notificationCount']) assert.equal(stage.persisted[key], stage.checkpoint[key]);
  assert.equal(stage.persisted.decisionCount, 1); assert.equal(stage.persisted.notificationCount, 3);
  for (const key of ['originalDecisionAndNoticesUnchanged', 'tripAndBookingUnchanged', 'parentViewScoped', 'outsiderDenied', 'unappliedTripStartDenied'])
    assert.equal(stage[key], true, key);
  for (const key of ['applicationExercised', 'routeProviderExercised', 'paymentExercised', 'fullAppReplay']) assert.equal(stage[key], false, key);
  assert.match(stage.limitation, /no pending\/refused\/withdrawn proposal recovery/);
});

test('ordinary conditional skips cannot stand in for the actual two-stage local test or erase earlier failures', () => {
  const suite = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '', parseAttributeValue: true,
    isArray: (name) => name === 'testcase' }).parse(text(base + 'completed/general-ui.xml')).testsuite;
  assert.equal(suite.tests, 106); assert.equal(suite.skipped, 24); assert.equal(suite.failures, 0); assert.equal(suite.errors, 0);
  const cases = suite.testcase.filter((item) => item.classname.endsWith('.LocalTripConsentRestartTest'));
  assert.equal(cases.length, 2); assert(cases.every((item) => Object.hasOwn(item, 'skipped')));
  const failedBase = 'docs/release/evidence/local-consent-restart-interruption-2026-10-17/';
  assert.equal(JSON.parse(text(failedBase + 'driver-review-action/local-trip-consent-restart-after.json')).completed, false);
  assert.equal(JSON.parse(text(failedBase + 'evidence-transport/adb-pull-trip-change-parent-confirmation.json')).completed, false);
  assert.match(text(base + 'README.md'), /does not explain or repair/);
});

test('only reviewed after and driver captures enter the partial partner flow while remaining release scope stays open', () => {
  const flow = content.flows.find((item) => item.id === 'publication'); assert.equal(flow.status, 'partial');
  const current = 'docs/release/evidence/local-trip-history-2026-10-18/';
  assert.equal(flow.source, 'docs/release/evidence/real-maps-local-2026-10-18/README.md');
  assert.equal(flow.ui.source, current + 'completed-native/results.json');
  assert(flow.ui.groups.includes('trip-consent-process-restart-ui')); assert.match(flow.verified, /Deux parents confirment/);
  assert.deepEqual(flow.images.slice(8, 10).map((item) => item.file), ['trip-consent-restored-parent', 'trip-consent-restored-driver']);
  for (const [id, name] of [['trip-consent-restored-parent', 'after'], ['trip-consent-restored-driver', 'driver']]) {
    assert.equal(captures[id], base + `completed/local-trip-consent-restart-${name}.png`);
    const png = bytes(captures[id]); assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.equal(png.readUInt32BE(16), 1080); assert.equal(png.readUInt32BE(20), 2140);
  }
  assert(!Object.values(captures).includes(base + 'completed/local-trip-consent-restart-before.png'));
  for (const scope of [/brouillons après fermeture/, /sur téléphone/, /application/, /paiements et remboursements réels/])
    assert.match(flow.remaining, scope);
  assert.equal(content.flows.find((item) => item.id === 'tracking').status, 'untested');
  const manifest = JSON.parse(text('docs/release/evidence-manifest.json'));
  assert.equal(manifest.storeReviewEvidence.items.find((item) => item.id === 'emergency_contact_action_screenshot').status, 'pending');
  for (const workflow of ['native-ci.yml', 'web-integration-smoke.yml'])
    assert.equal(text('.github/workflows/' + workflow).split('"tests/trip-consent-restart-completed-evidence.test.mjs"').length - 1, 2);
  assert(JSON.parse(text('package.json')).scripts['test:local-flow-isolation'].includes('tests/trip-consent-restart-completed-evidence.test.mjs'));
});

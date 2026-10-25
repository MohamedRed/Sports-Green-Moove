import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { XMLParser } from 'fast-xml-parser';
import { assertInstrumentationPassed } from '../scripts/qa/android-instrumentation-result.mjs';
import { assertTripScheduleReceipt } from '../scripts/qa/trip-change-schedule-evidence.mjs';
import { content, captures } from '../partner-portal/content.mjs';

const base = 'docs/release/evidence/local-trip-change-schedule-native-2026-10-17/';
const bytes = (path) => readFileSync(new URL('../' + path.split('/').map(encodeURIComponent).join('/'), import.meta.url));
const text = (path) => bytes(path).toString('utf8');
const json = (name) => JSON.parse(text(base + 'completed/' + name));
const runId = '76cf616fa629db00119e6d9c89052cf4';

test('the complete schedule replay preserves 27 groups, 19 transcripts, eight copies and 61 original files', () => {
  const hashes = json('artifact-sha256.json'); assert.equal(Object.keys(hashes).length, 61);
  for (const [name, hash] of Object.entries(hashes)) {
    const raw = bytes(base + 'completed/' + name);
    assert.equal(createHash('sha256').update(raw).digest('hex'), hash, name);
    if (!name.endsWith('.png')) assert.doesNotMatch(raw.toString(), /AIza[\w-]{20,}|Bearer\s+[\w.-]+|-----BEGIN .*PRIVATE KEY|"password"\s*:/);
  }
  for (const extension of ['xml', 'txt']) assert(text('.gitattributes').includes(`${base}**/*.${extension} -text -whitespace`));
  const run = json('results.json'); assert.equal(run.projectId, 'demo-sgm-local-qa'); assert.equal(run.runId, runId);
  assert.equal(run.scope, 'local-ui-not-physical-device'); assert.equal(run.testedAt, '2026-10-17T17:13:25.685Z');
  assert.equal(run.testCount, 27); assert.equal(run.steps.length, 27); assert.equal(new Set(run.steps.map((s) => s.id)).size, 27);
  assert(run.steps.every((s) => s.status === 'passed'));
  const previous = JSON.parse(text('docs/release/evidence/local-trip-change-inputs-native-2026-10-17/completed/results.json'));
  assert.deepEqual(run.steps.map((s) => s.id).sort(), [...previous.steps.map((s) => s.id), 'trip-change-schedule-ui'].sort());
  const transcripts = Object.keys(hashes).filter((name) => name.endsWith('-instrumentation.txt'));
  assert.equal(transcripts.length, 19);
  for (const name of transcripts) assertInstrumentationPassed(text(base + 'completed/' + name), name.startsWith('LocalAppFlowTest-') ? 9 : 1);
  const copies = Object.keys(hashes).filter((name) => name.startsWith('adb-pull-'));
  assert.equal(copies.length, 8);
  for (const name of copies) {
    const copy = json(name); assert.equal(copy.runId, runId); assert.equal(copy.completed, true);
    assert.equal(copy.status, 0); assert.equal(copy.signal, null); assert.equal(copy.errorCode, null);
  }
  assert.deepEqual(json('native-suite-status.json'), { scope: 'native-suite-exit-status-not-flow-verification',
    ordinaryTests: 0, componentEvidence: 0, localReplay: 0 });
  assert.deepEqual(run.tripSchedule, json('trip-change-schedule-ui-stage.json'));
  assert.deepEqual(run.tripChanges, json('trip-change-ui-stage.json'));
  assert.deepEqual(run.tripChangeInputs, json('trip-change-inputs-ui-stage.json'));
});

test('new native date and arrival consent remains distinct from application, providers, payment and physical tracking', () => {
  const stage = json('trip-change-schedule-ui-stage.json');
  assert.equal(stage.runId, runId); assert.equal(stage.testedAt, '2026-10-17T17:10:49.002Z');
  assert.equal(stage.recordType, 'native-trip-schedule-stage-not-full-run-result'); assert.equal(stage.testCount, 1);
  assertTripScheduleReceipt(json('local-trip-change-schedule-ui.json'), stage, runId);
  assert.deepEqual(stage.native, json('local-trip-change-schedule-ui.json'));
  for (const key of ['tripAndBookingUnchanged', 'parentViewScoped', 'outsiderDenied', 'datePickerExercised', 'desiredArrivalEditingExercised']) {
    assert.equal(stage[key], true, key);
  }
  for (const key of ['applicationExercised', 'routeProviderExercised', 'paymentExercised', 'fullAppReplay']) assert.equal(stage[key], false, key);
  assert.equal(stage.notificationCount, 3); assert.equal(stage.originalDepartureAt, '2026-10-18T09:00:00.000Z');
  assert.equal(stage.proposedDepartureAt, '2026-10-19T09:00:00.000Z'); assert.equal(stage.desiredArrivalBy, '2026-10-19T10:00:00.000Z');
  assert.match(stage.limitation, /no route change, application, payment, physical tracking or post-restart consent proof/);
  assert.match(text(base + 'completed/LocalTripChangeScheduleFlowTest-instrumentation.txt'), /Time: 39\.285/);
});

test('the passing ordinary keyboard probes do not erase the retained failures or prove a causal fix', () => {
  const suite = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '', parseAttributeValue: true,
    isArray: (name) => name === 'testcase' }).parse(text(base + 'completed/general-ui.xml')).testsuite;
  assert.equal(suite.tests, 104); assert.equal(suite.failures, 0); assert.equal(suite.errors, 0); assert.equal(suite.skipped, 22);
  const probes = suite.testcase.filter((item) => item.classname.endsWith('.InputWindowReadinessTest'));
  assert.equal(probes.length, 2); assert(probes.every((item) => !Object.hasOwn(item, 'skipped')));
  for (const name of ['activity-input-logcat.txt', 'dialog-input-logcat.txt']) {
    const log = text(base + 'completed/' + name);
    assert.match(log, /phase=before-window-focus .*windowFocused=true/);
    assert.match(log, /phase=\S+-keyboard-visible .*windowFocused=true .*servedView=true acceptingText=true keyboardVisible=true/);
    assert.doesNotMatch(log, /phase=\S+-failed/);
  }
  const previous = JSON.parse(text('docs/release/evidence/local-schedule-preparation-2026-10-17/adb-pull-trip-change-parent-confirmation.json'));
  assert.equal(previous.completed, false); assert.equal(previous.status, 1); assert.notEqual(previous.runId, runId);
  assert.match(text(base + 'README.md'), /does not explain either intermittent failure/);
});

test('only the reviewed schedule image is added and the private page retains the untested release scope', () => {
  const name = 'local-trip-change-date-arrival-confirmed.png', id = 'trip-date-arrival-confirmed';
  const flow = content.flows.find((item) => item.id === 'publication');
  assert.equal(flow.status, 'partial'); assert.equal(flow.ui.source, 'docs/release/evidence/local-trip-history-2026-10-18/completed-native/results.json');
  assert(flow.ui.groups.includes('trip-change-schedule-ui')); assert.equal(flow.source, 'docs/release/evidence/real-maps-native-2026-10-18/README.md');
  assert.equal(captures[id], base + 'completed/' + name); assert.deepEqual(json('trip-change-schedule-ui-stage.json').captureFiles, [name]);
  assert(flow.images.some((item) => item.file === id && /essai local du 17 octobre/.test(item.alt)));
  const png = bytes(captures[id]); assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  assert.equal(png.readUInt32BE(16), 1080); assert.equal(png.readUInt32BE(20), 2140);
  assert(flow.images.some((item) => /Nouvelle date et arrivée souhaitée/.test(item.alt)));
  assert.match(flow.remaining, /carte/);
  for (const scope of [/après fermeture/, /sur téléphone/, /paiements et remboursements réels/]) assert.match(flow.remaining, scope);
  assert.equal(content.flows.find((item) => item.id === 'tracking').status, 'partial');
  assert(content.updates.some((item) => item.title === 'La date et l’arrivée souhaitée sont confirmées' && item.date === '2026-10-17'));
  const manifest = JSON.parse(text('docs/release/evidence-manifest.json'));
  assert.equal(manifest.storeReviewEvidence.items.find((item) => item.id === 'emergency_contact_action_screenshot').status, 'pending');
  for (const workflow of ['native-ci.yml', 'web-integration-smoke.yml']) {
    assert.equal(text('.github/workflows/' + workflow).split('"tests/trip-schedule-completed-evidence.test.mjs"').length - 1, 2);
  }
  assert(JSON.parse(text('package.json')).scripts['test:local-flow-isolation'].includes('tests/trip-schedule-completed-evidence.test.mjs'));
});

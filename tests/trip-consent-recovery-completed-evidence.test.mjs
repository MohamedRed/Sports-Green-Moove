import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { XMLParser } from 'fast-xml-parser';
import { assertInstrumentationPassed } from '../scripts/qa/android-instrumentation-result.mjs';
import { recoveryKinds, assertRecoveryRestart } from '../scripts/qa/trip-consent-recovery-evidence.mjs';
import { content, captures } from '../partner-portal/content.mjs';

const base = 'docs/release/evidence/local-trip-consent-recovery-native-2026-10-17/';
const bytes = (path) => readFileSync(new URL('../' + path.split('/').map(encodeURIComponent).join('/'), import.meta.url));
const text = (path) => bytes(path).toString('utf8');
const json = (name) => JSON.parse(text(base + 'completed/' + name));
const runId = '223ded56b4c8c9eca5ab8d6f2ea61fbc';

test('completed recovery preserves 83 originals, all 32 groups, 23 transcripts and ten successful evidence copies', () => {
  const hashes = json('artifact-sha256.json'); assert.equal(Object.keys(hashes).length, 83);
  for (const [name, hash] of Object.entries(hashes)) {
    const raw = bytes(base + 'completed/' + name);
    assert.equal(createHash('sha256').update(raw).digest('hex'), hash, name);
    if (!name.endsWith('.png')) assert.doesNotMatch(raw.toString(), /AIza[\w-]{20,}|Bearer\s+[\w.-]+|"password"\s*:/);
  }
  const run = json('results.json'); assert.equal(run.runId, runId); assert.equal(run.projectId, 'demo-sgm-local-qa');
  assert.equal(run.testedAt, '2026-10-17T23:53:35.827Z'); assert.equal(run.scope, 'local-ui-not-physical-device');
  assert.equal(run.testCount, 32); assert.equal(run.steps.length, 32); assert(run.steps.every((s) => s.status === 'passed'));
  const previous = JSON.parse(text('docs/release/evidence/local-trip-consent-restart-native-2026-10-17/completed/results.json'));
  assert.deepEqual(run.steps.map((s) => s.id).sort(), [...previous.steps.map((s) => s.id),
    ...recoveryKinds.map((kind) => `trip-consent-${kind}-restart-ui`)].sort());
  const transcripts = Object.keys(hashes).filter((name) => name.endsWith('-instrumentation.txt'));
  assert.equal(transcripts.length, 23);
  for (const name of transcripts) assertInstrumentationPassed(text(base + 'completed/' + name), name.startsWith('LocalAppFlowTest-') ? 9 : 1);
  const copies = Object.keys(hashes).filter((name) => name.startsWith('adb-pull-')); assert.equal(copies.length, 10);
  for (const name of copies) {
    const copy = json(name); assert.equal(copy.runId, runId); assert.equal(copy.completed, true);
    assert.equal(copy.status, 0); assert.equal(copy.signal, null); assert.equal(copy.errorCode, null);
  }
  assert.deepEqual(json('native-suite-status.json'), { scope: 'native-suite-exit-status-not-flow-verification',
    ordinaryTests: 0, componentEvidence: 0, localReplay: 0 });
  assert.deepEqual(run.tripConsentRecovery, json('trip-consent-recovery-ui-stage.json'));
  for (const ext of ['txt', 'xml']) assert(text('.gitattributes').includes(`${base}**/*.${ext} -text -whitespace`));
});

test('four distinct native proposal states cross a new process and retain every complete record hash and scope', () => {
  const stage = json('trip-consent-recovery-ui-stage.json'); assert.equal(stage.runId, runId);
  assert.equal(stage.testedAt, '2026-10-17T23:52:07.098Z'); assert.equal(stage.nativeCaseCount, 2); assert.equal(stage.testCount, 4);
  assert.equal(stage.recordType, 'native-trip-consent-recovery-stage-not-full-run-result');
  const before = json('local-trip-consent-recovery-before.json'), after = json('local-trip-consent-recovery-after.json');
  const stopped = json('local-trip-consent-recovery-stop.json');
  const fixtures = Object.fromEntries(stage.checkpoint.map((record) => [record.kind, record]));
  assertRecoveryRestart(before, stopped, after, fixtures, runId);
  assert.deepEqual(stage.native, { before, after, stopped });
  assert.equal(before.processId, 11111); assert.equal(after.processId, 11308);
  assert.deepEqual(json('trip-consent-recovery-checkpoint.json'), { projectId: 'demo-sgm-local-qa', runId, records: stage.checkpoint });
  assert.deepEqual(stage.persisted, stage.checkpoint); assert.deepEqual(stage.persisted.map((r) => r.kind), recoveryKinds);
  assert.equal(new Set(stage.persisted.map((r) => r.proposalId)).size, 4);
  assert.deepEqual(stage.persisted.map((r) => r.status), ['pending', 'pending', 'declined', 'withdrawn']);
  assert.deepEqual(stage.persisted.map((r) => r.decisionCount), [0, 1, 1, 0]);
  assert.deepEqual(stage.persisted.map((r) => r.notificationCount), [2, 2, 5, 5]);
  for (const record of stage.persisted) {
    assert.equal(record.bookingIds.length, 2);
    assert.deepEqual(Object.keys(record.hashes).sort(), ['bookings', 'notifications', 'proposal', 'trip']);
    for (const hash of Object.values(record.hashes)) assert.match(hash, /^[a-f0-9]{64}$/);
  }
  for (const key of ['recordsUnchanged', 'parentViewsScoped', 'outsiderDenied']) assert.equal(stage[key], true);
  for (const key of ['applicationExercised', 'routeProviderExercised', 'paymentExercised', 'fullAppReplay']) assert.equal(stage[key], false);
  assert.match(stage.limitation, /terminal proposals have no history entry/);
});

test('ordinary skips remain separate from the actual local cases and neither success erases interrupted originals', () => {
  const suite = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '', parseAttributeValue: true,
    isArray: (name) => name === 'testcase' }).parse(text(base + 'completed/general-ui.xml')).testsuite;
  assert.equal(suite.tests, 108); assert.equal(suite.skipped, 26); assert.equal(suite.failures, 0); assert.equal(suite.errors, 0);
  const cases = suite.testcase.filter((c) => c.classname.endsWith('.LocalTripConsentRecoveryTest'));
  assert.equal(cases.length, 2); assert(cases.every((c) => Object.hasOwn(c, 'skipped')));
  const failed = 'docs/release/evidence/local-consent-restart-interruption-2026-10-17/';
  assert.equal(JSON.parse(text(failed + 'recovery-action-readiness/local-trip-consent-recovery-before.json')).completed, false);
  assert.equal(JSON.parse(text(failed + 'copy-with-diagnostics/adb-pull-trip-change-parent-confirmation.json')).completed, false);
  assert.match(text(base + 'README.md'), /does not prove the earlier intermittent copy/);
});

test('three earlier captures remain historical alongside newer evidence without hiding release gaps', () => {
  const flow = content.flows.find((f) => f.id === 'publication'); assert.equal(flow.status, 'partial');
  assert.equal(flow.source, 'docs/release/evidence/real-maps-native-2026-10-18/README.md');
  assert.equal(flow.ui.source, 'docs/release/evidence/local-trip-history-2026-10-18/completed-native/results.json');
  assert.equal(flow.ui.groups.length, 9);
  for (const kind of recoveryKinds) assert(flow.ui.groups.includes(`trip-consent-${kind}-restart-ui`));
  const ids = ['trip-consent-recovery-pending', 'trip-consent-recovery-partial', 'trip-consent-recovery-closed'];
  assert.deepEqual(flow.images.filter((i) => ids.includes(i.file)).map((i) => i.file), ids);
  for (const [index, name] of ['pending', 'partial', 'declined'].entries()) {
    assert.equal(captures[ids[index]], base + `completed/local-trip-consent-recovery-${name}.png`);
    const png = bytes(captures[ids[index]]); assert.equal(png.readUInt32BE(16), 1080);
    assert.equal(png.readUInt32BE(20), index === 2 ? 2400 : 2140);
  }
  assert(bytes(base + 'completed/local-trip-consent-recovery-declined.png')
    .equals(bytes(base + 'completed/local-trip-consent-recovery-withdrawn.png')));
  assert.equal(Object.values(captures).filter((p) => p.startsWith(base)).length, 3);
  const timeGap = content.blockers.find((b) => b.id === 'booking-time-display');
  assert.equal(timeGap.source, 'docs/release/evidence/local-trip-history-2026-10-18/README.md');
  assert.match(timeGap.text, /corrigé.*essai local/); assert.match(timeGap.next, /Rejouer sur téléphone/);
  for (const scope of [/sur téléphone/, /carte/, /brouillons/, /paiements et remboursements réels/])
    assert.match(flow.remaining, scope);
  assert.equal(content.flows.find((f) => f.id === 'tracking').status, 'untested');
  const manifest = JSON.parse(text('docs/release/evidence-manifest.json'));
  assert.equal(manifest.storeReviewEvidence.items.find((i) => i.id === 'emergency_contact_action_screenshot').status, 'pending');
  for (const workflow of ['native-ci.yml', 'web-integration-smoke.yml'])
    assert.equal(text('.github/workflows/' + workflow).split('"tests/trip-consent-recovery-completed-evidence.test.mjs"').length - 1, 2);
  assert(JSON.parse(text('package.json')).scripts['test:local-flow-isolation'].includes('tests/trip-consent-recovery-completed-evidence.test.mjs'));
});

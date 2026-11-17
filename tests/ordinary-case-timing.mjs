import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {parseDocument} from 'yaml';
import {observeIncompleteOrdinaryTranscript} from '../scripts/qa/ordinary-cutoff-observation.mjs';
import {parseAndroidJUnitTranscript} from '../scripts/qa/android-junit-transcript.mjs';

const root = new URL('../', import.meta.url);
const folder = 'docs/release/evidence/native-cutoff-142-2026-11-06/';
const bytes = file => readFileSync(new URL(file, root));
const json = file => JSON.parse(bytes(folder + file));
const sha = value => createHash('sha256').update(value).digest('hex');

test('the diagnostic candidate only adds one listener and one existing-query log tag', () => {
  const runner = bytes('scripts/qa/run-ordinary-android-ui.mjs').toString();
  const addition = "  '-e', 'listener', 'be.sportgreenmoove.app.ui.OrdinaryCaseTimingListener',\n";
  assert.equal(runner.split(addition).length, 2);
  assert.equal(sha(runner.replace(addition, '')), '2a05d95df6a9ce9c88602ca2d3e85a93d480a765d55ab3895c83db5132faefce');
  const collector = bytes('scripts/qa/native-process-failure-evidence.mjs').toString();
  assert.equal(collector.split("'SGMOrdinaryTiming:I', ").length, 2);
  assert.equal(sha(collector.replace("'SGMOrdinaryTiming:I', ", '')), 'b29447a5c181eb6b6e026839da473268dc8f8f2851e733112c409ece0fe8d7a7');
  for (const name of ['native-ci.yml', 'web-integration-smoke.yml']) {
    const workflow = parseDocument(bytes('.github/workflows/' + name).toString()).toJSON();
    for (const event of ['push', 'pull_request']) for (const path of [
      'tests/ordinary-case-timing.mjs', 'tests/fixtures/ordinary-case-timing/**',
      'scripts/qa/check-ordinary-case-timing.mjs', 'scripts/qa/ordinary-cutoff-observation.mjs',
      'scripts/qa/retain-native-cutoff-142.mjs', 'docs/release/evidence/native-cutoff-142-2026-11-06/**',
    ]) assert(workflow.on[event].paths.includes(path), name + ':' + event + ':' + path);
  }
});

test('retained failures bind original artifact members and cannot accept a complete ordinary suite', () => {
  const summary = json('summary.json');
  for (const row of summary.records) assert.equal(sha(bytes(folder + row.file)), row.sha256, row.file);
  for (const row of json('selected-members.json').members) {
    const raw = bytes(folder + row.file), value = row.encoding === 'gzip' ? gunzipSync(raw) : raw;
    assert.equal(value.length, row.originalBytes); assert.equal(sha(value), row.originalSha256);
    assert([13535194238, 13539586865].includes(row.artifactId));
  }
  const transcript = gunzipSync(bytes(folder + 'cutoff/ordinary-instrumentation.txt.gz')).toString();
  const observation = observeIncompleteOrdinaryTranscript(transcript);
  assert.deepEqual(observation, summary.ordinaryObservation);
  assert.deepEqual([observation.announcedCases, observation.startedCases, observation.endedCases,
    observation.endedWithZero, observation.skipped, observation.endedWithFailure], [354, 350, 349, 296, 53, 0]);
  assert.throws(() => parseAndroidJUnitTranscript(transcript));
  assert.deepEqual(json('cutoff/ordinary-process.json'), {
    scope: 'single-ordinary-instrumentation-command-not-flow-proof', status: null, signal: 'SIGTERM',
    errorCode: 'ETIMEDOUT', elapsedMs: 720005, stderr: '',
  });
  for (const key of ['ordinaryComplete', 'rootCauseConfirmed', 'clockDeviceEmissionObserved',
    'fullMatrixAccepted', 'physicalDeviceAccepted', 'releaseComplete']) assert.equal(summary[key], false);
  assert.deepEqual([summary.originalCaseInventory, summary.originalOrdinaryDeadlineMs, summary.originalPerCaseDeadlineMs], [354, 720000, 240000]);
});

test('Wi-Fi prerequisite, network preparation, policy restoration and passive host state remain distinct', () => {
  const wifi = json('wifi/network-readiness/outcome.json');
  assert.equal(wifi.failureKind, 'wifi-prerequisite-deadline'); assert.equal(wifi.sampleCount, 59);
  assert.equal(wifi.budgetMs, 180000); assert.equal(wifi.testAppsAbsent, true);
  for (const row of json('selected-members.json').members.filter(row => /wifi\/network-readiness\/sample/.test(row.file)))
    assert.equal(json(row.file).ready, false);
  const replay = json('cutoff/network/local-chat-network-ui.json');
  assert.equal(replay.completed, false); assert.equal(replay.failedPhase, 'network-preparation');
  assert.deepEqual(replay.network, []); assert.equal(replay.preparationFailure.hasDefaultDataSubscription, false);
  assert.equal(replay.preparationFailure.cellularAvailableCallbacks, 0);
  assert.equal(replay.preparationFailure.capabilityObservation.active.validated, true);
  assert.equal(json('cutoff/disposable-store-restore.json').verified, true);
  const host = json('cutoff/host-shutdown.json');
  assert.equal(host.finalState, 'zombie'); assert.equal(host.targetExitObserved, false);
  assert.equal(host.processSignalsRequested, false); assert.equal(host.flowAccepted, false);
});

test('actual listener compilation and injected callback checks are not device emission or app-flow proof', () => {
  const sources = json('source-sha256.json').files;
  for (const row of sources) {
    assert.equal(sha(bytes('docs/release/evidence/source-archive/' + row.sha256 + '.txt')), row.sha256);
    if (row.commit === 'candidate') assert.equal(sha(bytes(row.path)), row.sha256);
  }
  assert.match(bytes(folder + 'clock-checks.txt').toString(), /actual listener compiled against Android and JUnit/);
  assert.match(bytes(folder + 'clock-checks.txt').toString(), /1025-event cap; no device emission proof/);
});

const guard = 'INSTRUMENTATION_STATUS: sgm_installations_blocked=true\nINSTRUMENTATION_STATUS_CODE: 0\n';
const packet = (code, current = 1, name = 'example[small-phone]') =>
  'INSTRUMENTATION_STATUS: class=be.sportgreenmoove.Example\n' +
  `INSTRUMENTATION_STATUS: test=${name}\nINSTRUMENTATION_STATUS: current=${current}\n` +
  `INSTRUMENTATION_STATUS: numtests=2\nINSTRUMENTATION_STATUS_CODE: ${code}\n`;

test('partial observation preserves parameterized identity without claiming completion or a hang', () => {
  const value = observeIncompleteOrdinaryTranscript(guard + packet(1));
  assert.equal(value.lastObserved.name, 'example[small-phone]');
  assert.equal(value.endedCases, 0); assert.equal(value.flowAccepted, false); assert.equal(value.lastCaseHangProven, false);
});

for (const [name, transcript] of [
  ['missing guard', packet(1)], ['duplicate guard', guard + guard + packet(1)],
  ['mixed guard fields', guard.replace('INSTRUMENTATION_STATUS_CODE:', 'INSTRUMENTATION_STATUS: current=1\nINSTRUMENTATION_STATUS_CODE:') + packet(1)],
  ['missing matching start', guard + packet(0)],
  ['wrong terminal identity', guard + packet(1) + packet(0, 1, 'other')],
  ['overlapping starts', guard + packet(1) + packet(1, 2, 'other')],
  ['duplicate discovered identity', guard + packet(1) + packet(0) + packet(1, 2)],
  ['duplicate ordinal', guard + packet(1) + packet(0) + packet(1)],
  ['unfinished packet', guard + packet(1) + 'INSTRUMENTATION_STATUS: current=1\n'],
  ['final runner result', guard + packet(1) + packet(0) + 'INSTRUMENTATION_CODE: -1\n'],
]) test('diagnostic observation rejects ' + name, () => assert.throws(() => observeIncompleteOrdinaryTranscript(transcript)));

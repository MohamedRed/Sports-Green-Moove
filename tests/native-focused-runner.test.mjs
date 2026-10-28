import test from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { parseDocument } from 'yaml';
import { focusedCases } from '../scripts/qa/preinstalled-disposable-apks.mjs';
import { seedChatNetworkHistory } from '../scripts/qa/chat-network-history-fixture.mjs';
import { chatNetworkIsolatedFolder, validateChatNetworkIsolated } from '../scripts/qa/chat-network-isolated-evidence.mjs';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
function run(t, phase, overrides = {}) {
  const root = mkdtempSync(join(tmpdir(), 'sgm-focused-status-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const dir of ['scripts', 'bin']) mkdirSync(join(root, dir));
  cpSync(new URL('../scripts/run-focused-android-ui.sh', import.meta.url), join(root, 'scripts/run.sh'));
  const commands = [
    '*observe-network-bootstrap.mjs) echo bootstrap >> "$CALL_LOG"; exit "$BOOTSTRAP_STATUS";;',
    '*configure-continuous-disposable.mjs) echo setup >> "$CALL_LOG"; echo "{}"; exit "$SETUP_STATUS";;',
    '*restore-continuous-disposable.mjs) echo restore >> "$CALL_LOG"; echo "{}"; exit "$RESTORE_STATUS";;',
    '*observe-emulator-shutdown.mjs) echo observe >> "$CALL_LOG"; exit "$OBSERVER_STATUS";;',
    ...focusedCases.map((name) => `*run-local-${name}-ui.mjs) test -f "$SGM_PREINSTALLED_TEST_APKS_RECEIPT" || exit 97; test "$SGM_FOCUSED_UI_CASE" = ${name} || exit 98; echo ${name} >> "$CALL_LOG"; exit "$FLOW_STATUS";;`),
  ];
  writeFileSync(join(root, 'bin/node'), '#!/bin/bash\ncase "$1" in\n' + commands.join('\n') + '\n*) exit 99;;\nesac\n', { mode: 0o700 });
  const log = join(root, 'calls');
  const result = spawnSync('bash', [join(root, 'scripts/run.sh'), ...(phase == null ? [] : [phase])], {
    encoding: 'utf8', env: { ...process.env, PATH: join(root, 'bin') + ':' + process.env.PATH,
      CALL_LOG: log, SETUP_STATUS: '0', RESTORE_STATUS: '0', FLOW_STATUS: '0', OBSERVER_STATUS: '0', BOOTSTRAP_STATUS: '0',
      GITHUB_ACTIONS: 'false', ...overrides },
  });
  assert.equal(result.error, undefined);
  const output = join(root, 'android/app/build/outputs/focused-safety-ui', phase ?? '');
  const path = join(output, phase + '-suite-status.json');
  return { ...result, calls: existsSync(log) ? readFileSync(log, 'utf8').trim().split('\n') : [],
    outcome: existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : null };
}
const lifecycle = phase => [...(phase === 'chat-network-recovery' ? ['bootstrap'] : []), 'setup', phase, 'restore'];
for (const phase of focusedCases) {
  for (const [name, env, expected] of [
    ['passes', {}, 0], ['retains its failure', { FLOW_STATUS: '41' }, 41],
    ['requires cleanup', { RESTORE_STATUS: '13' }, 13],
    ['retains failure when cleanup also fails', { FLOW_STATUS: '41', RESTORE_STATUS: '13' }, 41],
  ]) test(phase + ' ' + name + ' on a dedicated phone', (t) => {
    const result = run(t, phase, env);
    assert.equal(result.status, expected, result.stderr);
    assert.deepEqual(result.calls, lifecycle(phase));
    assert.deepEqual(result.outcome, { scope: phase + '-command-status-not-flow-verification', status: Number(env.FLOW_STATUS ?? 0) });
  });
}
test('unsafe setup executes no flow and owns its rollback', (t) => {
  const result = run(t, 'emergency-identity', { SETUP_STATUS: '3' });
  assert.equal(result.status, 1); assert.deepEqual(result.calls, ['setup']); assert.equal(result.outcome, null);
});
test('CI observes host shutdown only after restored policy and never replaces the original outcome', t => {
  for (const [flow, restore, observer, expected] of [['0', '0', '0', 0], ['41', '0', '3', 41], ['0', '0', '3', 0], ['0', '13', '0', 13]]) {
    const result = run(t, 'ride-observation', { GITHUB_ACTIONS: 'true', RUNNER_OS: 'Linux',
      FLOW_STATUS: flow, RESTORE_STATUS: restore, OBSERVER_STATUS: observer });
    assert.equal(result.status, expected);
    assert.deepEqual(result.calls, ['setup', 'ride-observation', 'restore', ...(restore === '0' ? ['observe'] : [])]);
  }
});
test('missing, unknown or compound case selection changes no phone', (t) => {
  for (const phase of [undefined, 'all', 'emergency-identity; echo unsafe']) {
    const result = run(t, phase); assert.equal(result.status, 2); assert.deepEqual(result.calls, []);
  }
});
test('every independent case remains scheduled when another case fails', (t) => {
  const results = focusedCases.map((phase, index) => run(t, phase, { FLOW_STATUS: String(index === 0 ? 41 : 0) }));
  assert.deepEqual(results.map((result) => result.status), focusedCases.map((_, index) => index === 0 ? 41 : 0));
  assert.deepEqual(results.map((result) => result.calls), focusedCases.map(lifecycle));
});
test('all dedicated jobs and cleanup remain mandatory under the existing release gate', () => {
  assert.deepEqual(focusedCases, ['emergency-identity', 'ride-observation', 'native-startup', 'remote-ride-stop', 'session-restoration', 'session-disconnect', 'team-conversation', 'team-access', 'team-draft', 'team-read-components', 'chat-network-recovery']);
  const native = parseDocument(read('.github/workflows/native-ci.yml')).toJSON();
  const focused = parseDocument(read('.github/workflows/native-focused-ui.yml')).toJSON();
  assert.equal(native.jobs['android-focused-safety-ui'].uses, './.github/workflows/native-focused-ui.yml');
  assert(Object.values(native.jobs).some((job) => job.steps?.some((step) => JSON.stringify(step).includes('run-android-ui-tests-and-collect-screenshots.sh'))));
  const job = focused.jobs['focused-case'], gate = focused.jobs['focused-safety-ui'];
  assert.equal(job.strategy['fail-fast'], false); assert.deepEqual(job.strategy.matrix.case, focusedCases);
  assert(job.steps.some((step) => step.with?.script === 'bash scripts/run-focused-android-ui.sh ${{ matrix.case }}'));
  assert(job.steps.some((step) => step.if === '${{ always() }}' && step.with?.name === 'android-focused-safety-ui-${{ matrix.case }}'));
  const build = job.steps.findIndex((step) => step.name === 'Compile isolated app before starting the device');
  const device = job.steps.findIndex((step) => step.uses === 'reactivecircus/android-emulator-runner@v2');
  assert(build >= 0 && build < device); assert(job.steps[build].run.includes('-PSGM_USE_FIREBASE_EMULATOR=true'));
  for (const key of ['SGM_LOCAL_DISPOSABLE_EMULATOR', 'SGM_PAUSE_TEST_PHONE_STORE', 'SGM_BLOCK_TEST_PHONE_INSTALLS', 'SGM_TEST_PHONE_ADMIN_APPROVED'])
    assert.equal(job.steps[device].env[key], 'true');
  assert.equal(gate.name, 'Isolated safety flows'); assert.equal(gate.if, '${{ always() }}'); assert.equal(gate.needs, 'focused-case');
  assert.equal(gate.steps[0].env.FOCUSED_RESULT, '${{ needs.focused-case.result }}');
  for (const result of ['success', 'failure', 'cancelled', 'skipped', '']) {
    const status = spawnSync('bash', ['-c', gate.steps[0].run], { env: { ...process.env, FOCUSED_RESULT: result } }).status;
    assert.equal(status, result === 'success' ? 0 : 1);
  }
  assert(read('scripts/release-evidence-requirements.mjs').includes('Android focused safety UI tests / Isolated safety flows'));
  for (const name of ['native-ci.yml', 'web-integration-smoke.yml']) {
    const workflow = parseDocument(read('.github/workflows/' + name)).toJSON();
    for (const trigger of ['push', 'pull_request'])
      for (const path of ['scripts/run-focused-android-ui.sh', '.github/workflows/native-focused-ui.yml',
        'tests/native-focused-runner.test.mjs', 'tests/continuous-disposable-device.test.mjs',
        'tests/session-restoration-fault-proxy.test.mjs', 'tests/session-restoration-records.test.mjs', 'tests/session-disconnect.test.mjs'])
        assert(workflow.on[trigger].paths.includes(path), name + ': ' + path);
    for (const path of ['tests/native-focused-runner.test.mjs', 'tests/continuous-disposable-device.test.mjs',
      'tests/session-restoration-fault-proxy.test.mjs', 'tests/session-restoration-records.test.mjs', 'tests/session-disconnect.test.mjs'])
      assert(Object.values(workflow.jobs).some((entry) => entry.steps?.some((step) => step.run?.includes(path))));
  }
});
test('all focused flows explicitly choose pinned APK preparation and still uninstall at completion', () => {
  for (const phase of focusedCases) {
    if (phase === 'team-read-components') {
      const entry = read('scripts/qa/run-local-team-read-components-ui.mjs');
      assert(entry.includes("'--reads', '--focused-shell-restores'"));
      assert(entry.includes('SGM_PREINSTALLED_TEST_APKS_RECEIPT'));
      const runner = read('scripts/qa/run-team-chat-components.mjs');
      assert(runner.includes('if (!shellRestores) try {\n  restored = restoreContinuousDevice'));
      assert(runner.includes("cleanupOwner: 'focused-shell-independent-restoration-receipt-required'"));
      assert(runner.includes('apkPreparation = prepareDisposableTestApks({ adb, serial, android, run })'));
      continue;
    }
    const source = read(`scripts/qa/local-${phase}-ui.mjs`);
    assert(source.includes('if (!usePreinstalledTestApks()) {'));
    assert(source.includes('apkPreparation = prepareDisposableTestApks({ adb, serial, android, run })'));
    assert.equal(source.split('resetDisposableLocalApps(adb, serial)').length - 1, 1);
    assert(source.includes('...disposableApkSourceFiles')); assert(source.includes('localPackagesRemoved: true'));
  }
  for (const file of ['run-isolated-ride-ui.mjs', 'run-local-ride-observation-ui.mjs']) {
    const source = read('scripts/qa/' + file);
    for (const key of ['SGM_PREINSTALLED_TEST_APKS_RECEIPT', 'SGM_FOCUSED_UI_CASE', 'SGM_TEST_PHONE_ADMIN_APPROVED']) assert(source.includes(key));
  }
});

test('network bootstrap refusal does not install apps or start the isolated flow', t => {
  const result = run(t, 'chat-network-recovery', { BOOTSTRAP_STATUS: '31' });
  assert.equal(result.status, 1); assert.deepEqual(result.calls, ['bootstrap']); assert.equal(result.outcome, null);
});

const networkEnv = { SGM_LOCAL_DISPOSABLE_EMULATOR: 'true', GCLOUD_PROJECT: 'demo-sgm-local-qa', FIREBASE_PROJECT_ID: 'demo-sgm-local-qa' };
function networkHistoryClient({ failDecision = false, wrongStatus = false, parentUid = 'sgm-qa-parent' } = {}) {
  const calls = [], bookings = new Map(), trips = new Map();
  return { calls,
    async signIn(email) { return { uid: email === 'p@example.test' ? parentUid : 'sgm-qa-driver' }; },
    tripInput: () => ({ seatsTotal: 4, seatsAvailable: 4 }),
    async viewedBooking(actor, data) { assert.equal(actor.uid, parentUid); return { ...data, viewed: true }; },
    async call(name, actor, data) {
      calls.push({ name, actor: actor.uid, data });
      if (name === 'createTrip') {
        assert.equal(actor.uid, 'sgm-qa-driver');
        const tripId = 'trip-' + trips.size; trips.set(tripId, data); return { tripId };
      }
      if (name === 'requestBooking') {
        assert.equal(actor.uid, parentUid); assert.equal(data.viewed, true);
        const bookingId = 'booking-' + bookings.size;
        bookings.set(bookingId, { ...data, status: 'requested', parentUserId: parentUid, driverUserId: 'sgm-qa-driver' });
        return { bookingId };
      }
      assert(['declineBooking', 'cancelBooking'].includes(name));
      assert.equal(actor.uid, name === 'declineBooking' ? 'sgm-qa-driver' : parentUid);
      if (failDecision) throw new Error('decision rejected');
      if (!wrongStatus) bookings.get(data.bookingId).status = name === 'declineBooking' ? 'declined' : 'cancelled';
    },
    async document(collection, id) {
      assert(['trips', 'bookings'].includes(collection));
      return (collection === 'trips' ? trips : bookings).get(id);
    },
  };
}
test('independent network fixtures preserve refused and cancelled picker statuses through actual decision callables', async () => {
  const client = networkHistoryClient(), result = await seedChatNetworkHistory(client, networkEnv);
  assert.equal(result.method, 'isolated-callable-fixture-not-ui-verification');
  assert.deepEqual(result.bookings.map(row => row.status), ['declined', 'cancelled']);
  assert.deepEqual(client.calls.map(row => row.name),
    ['createTrip', 'requestBooking', 'declineBooking', 'createTrip', 'requestBooking', 'cancelBooking']);
  assert.equal(result.nativeUiExecuted, undefined);
});
test('network fixture guards and rejected decisions cannot create production data or fabricated history', async () => {
  for (const env of [{}, { ...networkEnv, SGM_LOCAL_DISPOSABLE_EMULATOR: 'false' },
    { ...networkEnv, GCLOUD_PROJECT: 'production' }, { ...networkEnv, FIREBASE_PROJECT_ID: 'production' }]) {
    const client = networkHistoryClient(); await assert.rejects(() => seedChatNetworkHistory(client, env));
    assert.equal(client.calls.length, 0);
  }
  const outsider = networkHistoryClient({ parentUid: 'outsider' });
  await assert.rejects(() => seedChatNetworkHistory(outsider, networkEnv)); assert.equal(outsider.calls.length, 0);
  for (const options of [{ failDecision: true }, { wrongStatus: true }]) {
    const client = networkHistoryClient(options);
    await assert.rejects(() => seedChatNetworkHistory(client, networkEnv));
    assert.equal(client.calls.filter(row => row.name === 'declineBooking').length, 1);
    assert(!client.calls.some(row => row.name === 'cancelBooking'));
  }
});
test('independent network trial reuses the exact native case, radio cleanup and persisted-message verifier', () => {
  const source = read('scripts/qa/local-chat-network-recovery-ui.mjs');
  for (const item of ['seedChatNetworkHistory(client)', 'seedChatNetworkUiFixture()',
    'replayWithNetworkCleanup(adb, serial, session.runId', 'verifyChatNetworkUi(fixture, directory)',
    "collect('network-recovery')", "collect('failure-cleanup')", 'assertInstrumentationPassed(transcript, expected)',
    'withLocalAdminCleanup', 'firestoreClientTerminated: true', 'nativeUiExecuted: true']) assert(source.includes(item), item);
  assert(source.indexOf("collect('network-recovery')") < source.indexOf('verifyChatNetworkUi(fixture, directory)'));
  assert(source.indexOf('if (failure) throw failure') < source.indexOf("scope: 'isolated-chat-network-ui-not-physical-network-loss'"));
  const full = read('scripts/qa/local-android-session.mjs');
  for (const item of ['replayWithNetworkCleanup(adb, serial, session.runId, instrument)',
    "collectEvidence('network-recovery')", 'verifyChatNetworkUi(networkFixture, evidenceDir)']) assert(full.includes(item));
  assert(read('scripts/qa/run-isolated-ride-ui.mjs').includes("'chat-network-recovery': 'local-chat-network-recovery-ui.mjs'"));
  assert(read('scripts/qa/run-local-chat-network-recovery-ui.mjs').includes("runIsolatedRideUi('chat-network-recovery')"));
  assert(read('android/app/src/androidTest/java/be/sportgreenmoove/app/ui/LocalChatNetworkFlowTest.kt')
    .includes('compose.waitUntil(30_000)'));
});

test('retained independent network pass binds the native case, primary copy, saved state and separate cleanup', async () => {
  const result = validateChatNetworkIsolated(process.cwd());
  assert.equal(result.run.network.messageCount, 2); assert.equal(result.run.network.duplicateMessages, 0);
  assert.equal(Object.keys(result.publishedCaptures).length, 2); assert.equal(result.run.physicalDevice, false);
  const { content, captures } = await import('../partner-portal/content.mjs');
  const flow = content.flows.find(row => row.id === 'messages');
  assert.equal(flow.status, 'partial'); assert.equal(flow.checkedAt, '2026-10-28');
  assert.equal(flow.networkRecovery.checkedAt, '2026-10-27');
  assert.equal(flow.networkRecoveryRecheck.checkedAt, '2026-10-28');
  assert.equal(flow.ui.checkedAt, '2026-10-19');
  assert.deepEqual(flow.tour.map(row => row.image), Object.keys(result.publishedCaptures));
  assert(flow.images.some(row => row.file === 'chat-network-current-draft'));
  for (const [id, file] of Object.entries(result.publishedCaptures)) assert.equal(captures[id], chatNetworkIsolatedFolder + file);
  assert(content.updates.some(row => row.flow === 'messages' && row.source === chatNetworkIsolatedFolder + 'README.md'));
  assert.equal(content.updates.find(row => row.flow === 'messages').source,
    'docs/release/evidence/chat-network-recheck-7417e22-2026-10-28/README.md');
  assert(content.updates.some(row => row.source === 'docs/release/evidence/dependency-patch-2026-10-28/previous-ci/README.md'));
  assert(!Object.values(captures).some(file => file === chatNetworkIsolatedFolder + 'captures/local-chat-network-recovered.png'));
  const attributes = spawnSync('git', ['check-attr', 'text', 'whitespace', '--',
    chatNetworkIsolatedFolder + 'LocalChatNetworkFlowTest-instrumentation.txt'], { encoding: 'utf8' });
  assert.equal(attributes.status, 0); assert.match(attributes.stdout, /text: unset/); assert.match(attributes.stdout, /whitespace: unset/);
});

for (const [file, mutate] of [
  ['chat-network-recovery-results.json', row => { row.physicalDevice = true; }],
  ['chat-network-recovery-results.json', row => { row.network.duplicateMessages = 1; }],
  ['chat-network-recovery-results.json', row => { row.isolatedEnvironmentDestroyed = false; }],
  ['local-chat-network-ui.json', row => { row.network[2].backendReachable = true; }],
  ['adb-pull-network-recovery.json', row => { row.completed = false; }],
  ['disposable-device-restore.json', row => { row.verified = false; }],
  ['artifact.json', row => { row.workflow_run.head_sha = '0'.repeat(40); }],
  ['visual-review.json', row => { row.published['unreviewed-image'] = 'captures/local-chat-network-recovered.png'; }],
]) test('scoped network evidence rejects unsupported state: ' + file + ' ' + mutate, t => {
  const root = mkdtempSync(join(tmpdir(), 'sgm-isolated-network-evidence-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const target = join(root, chatNetworkIsolatedFolder);
  cpSync(chatNetworkIsolatedFolder, target, { recursive: true });
  const archives = join(root, 'docs/release/evidence/source-archive'); mkdirSync(archives, { recursive: true });
  const run = JSON.parse(readFileSync(join(target, 'chat-network-recovery-results.json')));
  for (const hash of new Set(Object.values(run.sourceFiles)))
    cpSync('docs/release/evidence/source-archive/' + hash + '.txt', join(archives, hash + '.txt'));
  const path = join(target, file), row = JSON.parse(readFileSync(path)); mutate(row);
  writeFileSync(path, JSON.stringify(row));
  const checksums = join(target, 'artifact-sha256.json'), hashes = JSON.parse(readFileSync(checksums));
  hashes[file] = createHash('sha256').update(readFileSync(path)).digest('hex'); writeFileSync(checksums, JSON.stringify(hashes));
  assert.throws(() => validateChatNetworkIsolated(root));
});

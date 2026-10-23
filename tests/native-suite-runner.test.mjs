import test from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

function fixture(t, { missingChatCapture } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'sgm-suite-status-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const dir of ['scripts', 'android', 'bin']) mkdirSync(join(root, dir));
  cpSync(new URL('../scripts/run-android-ui-tests-and-collect-screenshots.sh', import.meta.url), join(root, 'scripts/run.sh'));
  const log = join(root, 'calls');
  const adbLog = join(root, 'adb-calls');
  const executable = (path, content) => {
    const teamCopy = path === 'bin/adb' ? [
      'if [[ "$1" == pull && "$2" == /sdcard/Download/sgm-team-enrollment && "$CAPTURE_FAILURE" == teams ]]; then exit 9; fi',
      'if [[ "$1" == pull && "$2" == /sdcard/Download/sgm-team-history && "$CAPTURE_FAILURE" == history ]]; then exit 9; fi',
      'if [[ "$1" == pull && "$2" == /sdcard/Download/sgm-child-emergency-components && "$CAPTURE_FAILURE" == child ]]; then exit 9; fi',
      'if [[ "$1" == pull && "$2" == /sdcard/Download/sgm-neutral-text && "$CAPTURE_FAILURE" == neutral ]]; then exit 9; fi',
      'if [[ "$1" == pull && "$2" == /sdcard/Download/sgm-team-chat-components && "$CAPTURE_FAILURE" == chat ]]; then exit 9; fi',
      '',
    ].join('\n') : '';
    writeFileSync(join(root, path), '#!/bin/bash\n' + teamCopy + content, { mode: 0o700 });
  };
  executable('android/gradlew', 'echo forbidden-build >> "$CALL_LOG"\nexit 98\n');
  executable('bin/node', [
    'case "$1" in',
    '*observe-network-bootstrap.mjs) echo bootstrap >> "$CALL_LOG"; exit "$BOOTSTRAP_STATUS";;',
    '*configure-continuous-disposable.mjs) echo setup >> "$CALL_LOG"; echo "{}"; exit "$SETUP_STATUS";;',
    '*run-ordinary-android-ui.mjs) echo ordinary >> "$CALL_LOG"; exit "$ORDINARY_STATUS";;',
    '*verify-disposable-installations.mjs) exit "${INSTALL_GUARD_STATUS:-0}";;',
    '*collect-ordinary-android-failure.mjs) echo diagnostic >> "$CALL_LOG"; exit "$DIAGNOSTIC_STATUS";;',
    '*adb-host-health.mjs) echo host-health >> "$CALL_LOG"; exit "$HOST_HEALTH_STATUS";;',
    '*restore-continuous-disposable.mjs) echo restore >> "$CALL_LOG"; echo "{}"; exit "$RESTORE_STATUS";;',
    '*observe-emulator-shutdown.mjs) echo observe >> "$CALL_LOG"; exit "${OBSERVATION_STATUS:-0}";;',
    '*run-local-android-flows.mjs) echo replay >> "$CALL_LOG"; exit "$REPLAY_STATUS";;',
    '*) exit 99;;', 'esac', '',
  ].join('\n'));
  executable('bin/adb', 'printf "%s\\n" "$*" >> "$ADB_CALL_LOG"\nif [[ "$1" == pull && "$2" == /sdcard/Download/sgm-session-restoration && "$CAPTURE_FAILURE" == 1 ]]; then exit 9; fi\nif [[ "$1" == pull && "$2" == /sdcard/Download/sgm-store-review && "$CAPTURE_FAILURE" == store ]]; then exit 9; fi\nif [[ "$1" == pull && "$2" == /sdcard/Download/sgm-payment-confirmation && "$CAPTURE_FAILURE" == payments ]]; then exit 9; fi\nif [[ "$1" == pull && "$2" == /sdcard/Download/sgm-emergency-contact && "$CAPTURE_FAILURE" == emergency ]]; then exit 9; fi\nexit 0\n');
  const out = join(root, 'android/app/build/outputs/store-review-screenshots');
  mkdirSync(out, { recursive: true });
  const screens = {
    'sgm-team-chat-components': [
      ...['team-chat-narrow', 'team-chat-denied', 'team-chat-unconfirmed', 'team-chat-confirmed',
        'team-read-count-narrow', 'team-read-visible', 'team-read-error', 'team-read-retry', 'team-read-revoked']
        .flatMap(stem => ['.png', '-window.png', '.json'].map(suffix => stem + suffix)),
      ...['team-draft-read-error', 'team-draft-write-error'].flatMap(stem => ['.png', '-window.png'].map(suffix => stem + suffix)),
    ].filter(name => name !== missingChatCapture),
    'sgm-neutral-text': ['search', 'trips'].flatMap(screen => ['light', 'dark'].flatMap(theme =>
      ['phone', 'wide'].flatMap(format => ['.png', '-window.png', '.json'].map(suffix => `${screen}-${theme}-${format}${suffix}`)))),
    'sgm-child-emergency-components': ['child-emergency-readonly-narrow', 'child-emergency-access-denied', 'child-emergency-landscape-changed']
      .flatMap((name) => [name + '.png', name + '-window.png']),
    'sgm-team-history': ['team-history-paging.png', 'team-history-paging-window.png', 'team-history-redacted-child.png', 'team-history-redacted-child-window.png'],
    'sgm-team-enrollment': ['team-requested.png', 'team-requested-window.png', 'team-approved-narrow.png', 'team-approved-narrow-window.png'],
    'sgm-emergency-contact': ['emergency-editor-narrow.png', 'emergency-editor-narrow-window.png', 'emergency-editor-changed.png', 'emergency-editor-changed-window.png'],
    'sgm-payment-confirmation': ['payment-pending-narrow.png', 'payment-pending-narrow-window.png', 'payment-review.png', 'payment-review-window.png'],
    'sgm-session-restoration': ['session-restoration-error.png', 'session-restoration-narrow.png'],
    'sgm-booking-review': ['booking-review-required.png', 'booking-review-narrow.png'],
    'sgm-booking-feedback': ['booking-feedback-sending-narrow.png', 'booking-feedback-confirmed-narrow.png', 'booking-feedback-width-probe.json'],
    'sgm-trip-changes': ['trip-change-driver-proposed', 'trip-change-parent-review-large-text', 'trip-change-parent-accepted',
      'trip-change-parent-declined', 'trip-change-applied-balance-due', 'trip-draft-restored-large-text'].flatMap((name) => [name + '.png', name + '-window.png']),
  };
  for (const [directory, names] of Object.entries(screens)) {
    mkdirSync(join(out, directory));
    for (const name of names) writeFileSync(join(out, directory, name), 'shell-harness-fixture-not-device-evidence');
  }
  for (let i = 0; i < 8; i++) writeFileSync(join(out, `store-${i}.png`), 'shell-harness-fixture');
  return (env) => {
    const result = spawnSync('bash', [join(root, 'scripts/run.sh')], { encoding: 'utf8', env: { ...process.env,
      PATH: join(root, 'bin') + ':' + process.env.PATH, CALL_LOG: log, ADB_CALL_LOG: adbLog, ORDINARY_STATUS: '0', REPLAY_STATUS: '0',
      GITHUB_ACTIONS: 'false', BOOTSTRAP_STATUS: '0', SETUP_STATUS: '0', RESTORE_STATUS: '0', DIAGNOSTIC_STATUS: '0', HOST_HEALTH_STATUS: '0', CAPTURE_FAILURE: '0', ...env } });
    assert.equal(result.error, undefined);
    const statusFile = join(out, 'native-suite-status.json');
    return { ...result, calls: readFileSync(log, 'utf8').trim().split('\n'),
      adbCalls: existsSync(adbLog) ? readFileSync(adbLog, 'utf8').trim().split('\n') : [],
      statuses: existsSync(statusFile) ? JSON.parse(readFileSync(statusFile, 'utf8')) : null };
  };
}

for (const [name, env, exit, statuses] of [
  ['both required suites pass', {}, 0, [0, 0, 0]],
  ['ordinary failure still executes the isolated replay', { ORDINARY_STATUS: '7' }, 7, [7, 0, 0]],
  ['capture failure cannot suppress the replay or produce a green job', { CAPTURE_FAILURE: '1' }, 1, [0, 1, 0]],
  ['stale store files cannot hide a failed fresh copy', { CAPTURE_FAILURE: 'store' }, 1, [0, 1, 0]],
  ['stale payment component files cannot hide a failed fresh copy', { CAPTURE_FAILURE: 'payments' }, 1, [0, 1, 0]],
  ['stale contact component files cannot hide a failed fresh copy', { CAPTURE_FAILURE: 'emergency' }, 1, [0, 1, 0]],
  ['stale team component files cannot hide a failed fresh copy', { CAPTURE_FAILURE: 'teams' }, 1, [0, 1, 0]],
  ['stale owned-history component files cannot hide a failed fresh copy', { CAPTURE_FAILURE: 'history' }, 1, [0, 1, 0]],
  ['stale child contact files cannot hide a failed fresh copy', { CAPTURE_FAILURE: 'child' }, 1, [0, 1, 0]],
  ['stale neutral text files cannot hide a failed fresh copy', { CAPTURE_FAILURE: 'neutral' }, 1, [0, 1, 0]],
  ['stale team chat files cannot hide a failed fresh copy', { CAPTURE_FAILURE: 'chat' }, 1, [0, 1, 0]],
  ['isolated replay failure is never overwritten by ordinary success', { REPLAY_STATUS: '11' }, 11, [0, 0, 11]],
  ['both failures retain both outcomes and return the first', { ORDINARY_STATUS: '7', REPLAY_STATUS: '11' }, 7, [7, 0, 11]],
]) test(name, (t) => {
  const result = fixture(t)(env);
  assert.equal(result.status, exit, result.stderr);
  assert.deepEqual(result.calls, ['bootstrap', 'setup', 'ordinary', ...(env.ORDINARY_STATUS ? ['diagnostic'] : []),
    ...(env.CAPTURE_FAILURE ? ['host-health'] : []), 'replay', ...(env.REPLAY_STATUS ? ['host-health'] : []), 'restore']);
  assert.equal(result.statuses.scope, 'native-suite-exit-status-not-flow-verification');
  assert.deepEqual([result.statuses.ordinaryTests, result.statuses.componentEvidence, result.statuses.localReplay], statuses);
});

test('failed suites retain partial payment and other component captures without replacing the original failure', (t) => {
  const result = fixture(t)({ ORDINARY_STATUS: '7', CAPTURE_FAILURE: 'payments' });
  assert.equal(result.status, 7);
  assert.match(result.stdout, /Could not collect partial component screenshots: sgm-payment-confirmation/);
  for (const name of ['sgm-trip-changes', 'sgm-payment-confirmation', 'sgm-session-restoration', 'sgm-booking-review', 'sgm-booking-feedback', 'sgm-emergency-contact', 'sgm-team-enrollment', 'sgm-team-history', 'sgm-neutral-text', 'sgm-team-chat-components']) {
    assert(result.adbCalls.some((call) => call.startsWith('pull /sdcard/Download/' + name + ' ') && call.endsWith('/partial-components')));
  }
  assert.deepEqual(result.calls, ['bootstrap', 'setup', 'ordinary', 'diagnostic', 'replay', 'restore']);
  assert.equal(result.statuses.ordinaryTests, 7);
});

for (const stem of ['team-draft-read-error', 'team-draft-write-error']) for (const suffix of ['.png', '-window.png'])
  test(`a missing ${stem}${suffix} fails capture verification without suppressing replay or cleanup`, (t) => {
    const result = fixture(t, { missingChatCapture: stem + suffix })({});
    assert.equal(result.status, 1);
    assert.match(result.stderr, new RegExp('Missing team draft error component evidence: ' + stem));
    assert.equal(result.statuses.ordinaryTests, 0); assert.equal(result.statuses.componentEvidence, 1);
    assert.equal(result.statuses.localReplay, 0);
    assert.deepEqual(result.calls, ['bootstrap', 'setup', 'ordinary', 'host-health', 'replay', 'restore']);
  });

for (const stem of ['team-read-count-narrow', 'team-read-visible', 'team-read-error', 'team-read-retry', 'team-read-revoked'])
  for (const suffix of ['.png', '-window.png', '.json'])
    test(`missing read component ${stem}${suffix} fails evidence collection and still restores the device`, t => {
      const result = fixture(t, { missingChatCapture: stem + suffix })({});
      assert.equal(result.status, 1);
      assert.match(result.stderr, new RegExp('Missing team chat component evidence: ' + stem));
      assert.equal(result.statuses.ordinaryTests, 0); assert.equal(result.statuses.componentEvidence, 1);
      assert.equal(result.statuses.localReplay, 0);
      assert.deepEqual(result.calls, ['bootstrap', 'setup', 'ordinary', 'host-health', 'replay', 'restore']);
    });

test('unavailable process diagnostics never suppress the original failure or the independent replay', (t) => {
  const result = fixture(t)({ ORDINARY_STATUS: '7', DIAGNOSTIC_STATUS: '9' });
  assert.equal(result.status, 7);
  assert.match(result.stdout, /original test failure is preserved/);
  assert.deepEqual(result.calls, ['bootstrap', 'setup', 'ordinary', 'diagnostic', 'replay', 'restore']);
  assert.equal(result.statuses.ordinaryTests, 7);
});

test('an unsafe or unavailable device stops both suites before app execution', (t) => {
  const result = fixture(t)({ SETUP_STATUS: '3' });
  assert.equal(result.status, 1); assert.deepEqual(result.calls, ['bootstrap', 'setup']); assert.equal(result.statuses, null);
});

test('unavailable early network diagnostics cannot start device mutations or claim cleanup', t => {
  const result = fixture(t)({ BOOTSTRAP_STATUS: '17' });
  assert.equal(result.status, 1); assert.deepEqual(result.calls, ['bootstrap']); assert.equal(result.statuses, null);
  assert.deepEqual(result.adbCalls, []);
});

test('an unverified installation guard stops further replay and still runs restoration', (t) => {
  const result = fixture(t)({ INSTALL_GUARD_STATUS: '23' });
  assert.equal(result.status, 23); assert.equal(result.statuses, null);
  assert.deepEqual(result.calls, ['bootstrap', 'setup', 'ordinary', 'restore']);
  assert.deepEqual(result.adbCalls, []);
});

test('store cleanup failure cannot produce a green suite or overwrite an earlier failure', (t) => {
  const success = fixture(t)({ RESTORE_STATUS: '13' });
  assert.equal(success.status, 13); assert.deepEqual(success.calls, ['bootstrap', 'setup', 'ordinary', 'replay', 'restore']);
  const failure = fixture(t)({ RESTORE_STATUS: '13', REPLAY_STATUS: '11' });
  assert.equal(failure.status, 11); assert.deepEqual(failure.calls, ['bootstrap', 'setup', 'ordinary', 'replay', 'host-health', 'restore']);
});

test('unavailable host observations never suppress either suite failure or store restoration', (t) => {
  const result = fixture(t)({ CAPTURE_FAILURE: 'store', REPLAY_STATUS: '11', HOST_HEALTH_STATUS: '19' });
  assert.equal(result.status, 1); assert.deepEqual(result.calls,
    ['bootstrap', 'setup', 'ordinary', 'host-health', 'replay', 'host-health', 'restore']);
  assert.equal(result.statuses.componentEvidence, 1); assert.equal(result.statuses.localReplay, 11);
  assert.match(result.stdout, /original component failure is preserved/);
  assert.match(result.stdout, /original replay failure is preserved/);
});

test('host observation follows verified cleanup and never replaces the suite outcome', t => {
  const result = fixture(t)({ GITHUB_ACTIONS: 'true', RUNNER_OS: 'Linux', OBSERVATION_STATUS: '21', REPLAY_STATUS: '11' });
  assert.equal(result.status, 11);
  assert.deepEqual(result.calls, ['bootstrap', 'setup', 'ordinary', 'replay', 'host-health', 'restore', 'observe']);
  const failedCleanup = fixture(t)({ GITHUB_ACTIONS: 'true', RUNNER_OS: 'Linux', RESTORE_STATUS: '13' });
  assert.equal(failedCleanup.status, 13); assert(!failedCleanup.calls.includes('observe'));
});

test('both CI entry points retain independent-suite verification and upload its status metadata', () => {
  for (const name of ['native-ci.yml', 'web-integration-smoke.yml']) {
    const workflow = readFileSync(new URL('../.github/workflows/' + name, import.meta.url), 'utf8');
    assert.equal(workflow.split('"tests/native-suite-runner.test.mjs"').length - 1, 2);
  }
  const workflow = readFileSync(new URL('../.github/workflows/native-ci.yml', import.meta.url), 'utf8');
  assert(workflow.includes('android/app/build/outputs/store-review-screenshots/**'));
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert(pkg.scripts['test:local-flow-isolation'].includes('tests/native-suite-runner.test.mjs'));
});

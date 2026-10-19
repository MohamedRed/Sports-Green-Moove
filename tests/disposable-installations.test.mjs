import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readInstallBlocked, setInstallBlocked, withTestApkInstallWindow } from '../scripts/qa/disposable-installations.mjs';
import { installationGuardArguments } from '../scripts/qa/install-disposable-test-apks.mjs';
import { validateDisposableInstallationReceipts } from '../scripts/qa/disposable-installation-evidence.mjs';
import { playServicesVersionCommand } from '../scripts/qa/android-maps-prerequisites.mjs';
import { createHash } from 'node:crypto';
import { XMLParser } from 'fast-xml-parser';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
test('actual guard activation and administrator removal do not turn the interrupted replay into a pass', () => {
  const base = 'docs/release/evidence/disposable-installation-guard-2026-10-18/verified-2026-10-19/';
  const json = (file) => JSON.parse(read(base + file));
  const setup = json('disposable-device-setup.json'), locked = json('disposable-installations-verified.json');
  const restored = json('disposable-store-restore.json');
  assert.deepEqual(validateDisposableInstallationReceipts(setup, locked, restored),
    { scope: 'disposable-installation-policy-only-not-flow-or-release-proof', status: 'passed' });
  const hashes = json('artifact-sha256.json'); assert.equal(Object.keys(hashes).length, 9);
  for (const [file, expected] of Object.entries(hashes))
    assert.equal(createHash('sha256').update(readFileSync(new URL('../' + base + file, import.meta.url))).digest('hex'), expected, file);
  const suite = new XMLParser({ ignoreAttributes: false }).parse(read(base + 'ordinary-tests.xml')).testsuite;
  assert.equal(Number(suite['@_tests']), 144); assert.equal(Number(suite['@_skipped']), 34);
  assert.equal(Number(suite['@_failures']), 0); assert.equal(Number(suite['@_errors']), 0);
  assert.deepEqual(json('native-suite-status.json'), { scope: 'native-suite-exit-status-not-flow-verification',
    ordinaryTests: 0, componentEvidence: 0, localReplay: 1 });
  const primary = json('adb-pull-trip-consent-recovery.json');
  assert.equal(primary.phase, 'trip-consent-recovery'); assert.equal(primary.status, 1); assert.equal(primary.completed, false);
  const observations = json('adb-sync-trip-consent-recovery-diagnostics.json').observations;
  for (const id of ['directory-stat', 'shell-listing', 'sync-listing'])
    assert.match(observations.find((item) => item.id === id).stderr, /device offline/);
  for (const patch of [{ verified: false }, { restored: false },
    { installAdmin: { ...restored.installAdmin, authorizationRemoved: false } },
    { observed: { ...restored.observed, locationEnabled: false } }])
    assert.throws(() => validateDisposableInstallationReceipts(setup, locked, { ...restored, ...patch }));
});
function device(options = {}) {
  let blocked = options.blocked ?? true, version = '24.23.35';
  const calls = [];
  const shell = (...args) => {
    const command = args.join(' '); calls.push(command);
    if (command === 'getprop ro.build.version.sdk') return options.sdk ?? '35';
    if (command === 'getprop ro.kernel.qemu') return options.qemu ?? '1';
    if (command === 'am get-current-user') return options.user ?? '0';
    if (command === 'pm get-user-restriction --user 0 no_install_apps') return options.malformed ?? String(blocked);
    if (command.startsWith('am broadcast --user 0 --receiver-foreground ')) {
      if (!options.ignored) blocked = args.at(-1) === 'true';
      return `Broadcast completed: result=-1, data="SGM_INSTALL_BLOCKED=${args.at(-1)}"`;
    }
    if (command.startsWith('pm list packages -e --user 0 ')) return `package:${args.at(-1)}`;
    if (command === playServicesVersionCommand) return 'versionName=' + version;
    if (command === 'dumpsys package installs') return options.installs ?? 'Active install sessions:\nHistorical install sessions:\n';
    if (command === 'am force-stop --user 0 com.android.vending') return '';
    throw new Error('Unexpected shell command: ' + command);
  };
  return { shell, calls, blocked: () => blocked, changeMaps: () => { version = '26.40.32'; } };
}

test('a narrowly scoped two-APK window is re-locked before any replay starts', () => {
  const phone = device(); let installs = 0;
  withTestApkInstallWindow(phone.shell, () => { assert.equal(phone.blocked(), false); installs += 2; });
  assert.equal(installs, 2); assert.equal(phone.blocked(), true);
  assert.deepEqual(phone.calls.filter((value) => value.startsWith('am broadcast')).map((value) => value.split(' ').at(-1)), ['false', 'true']);
});
test('an interrupted APK install preserves its failure and still re-locks installations', () => {
  const phone = device(), original = new Error('test APK installation failed');
  assert.throws(() => withTestApkInstallWindow(phone.shell, () => { throw original; }), (error) => {
    assert(error.errors.includes(original)); return true;
  });
  assert.equal(phone.blocked(), true);
});
test('a runtime mutation during an installation window is never accepted as a clean run', () => {
  const phone = device();
  assert.throws(() => withTestApkInstallWindow(phone.shell, phone.changeMaps), /installation or re-lock failed/);
  assert.equal(phone.blocked(), true);
});
test('physical, other-user, incompatible, unguarded or active-install devices refuse the window before mutation', () => {
  for (const options of [{ qemu: '0' }, { user: '10' }, { sdk: '34' }, { blocked: false }, { malformed: 'unknown' },
    { installs: 'Active install sessions:\n  Session 22:\n    appPackageName=example.app mDestroyed=false\nHistorical install sessions:\n' }]) {
    const phone = device(options); let installed = false;
    assert.throws(() => withTestApkInstallWindow(phone.shell, () => { installed = true; }));
    assert.equal(installed, false);
    assert(!phone.calls.some((line) => /force-stop|am broadcast/.test(line)));
  }
});
test('missing restriction support and ignored writes fail closed without an inferred default', () => {
  for (const malformed of ['', 'unknown', 'false\ntrue', 'Error: unavailable'])
    assert.throws(() => readInstallBlocked(device({ malformed }).shell));
  assert.throws(() => setInstallBlocked(device({ ignored: true }).shell, false), /not applied/);
});
test('restoring an already-original policy is a verified no-op, not an unnecessary privileged write', () => {
  const phone = device({ blocked: false }); setInstallBlocked(phone.shell, false);
  assert.equal(phone.blocked(), false); assert(!phone.calls.some((line) => line.startsWith('am broadcast')));
});
test('all instrumentation entry points use the guarded AndroidX runner and the explicit opt-in', () => {
  const runner = 'be.sportgreenmoove.app.ui.DisposableAndroidJUnitRunner';
  assert(read('android/app/build.gradle.kts').includes(`testInstrumentationRunner = "${runner}"`));
  const source = read('android/app/src/androidTest/java/be/sportgreenmoove/app/ui/DisposableAndroidJUnitRunner.kt');
  assert(source.includes(': AndroidJUnitRunner()'));
  assert(source.indexOf('am broadcast') < source.indexOf('super.onStart()'));
  assert(!source.includes('pm set-user-restriction'));
  assert(source.includes('uiAutomation.executeShellCommand(command)'));
  assert(source.includes("require(command.none"));
  assert(!source.includes('SGM_COMMAND_EXIT'));
  assert(source.includes('no tests were started'));
  assert(source.includes('getprop ro.kernel.qemu') && source.includes('am get-current-user'));
  assert(source.includes('finish(Activity.RESULT_CANCELED'));
  for (const entry of ['local-android-session.mjs', 'real-maps-android-session.mjs']) {
    const file = read('scripts/qa/' + entry);
    assert(file.includes('installDisposableTestApks({ adb, serial, android, run })'));
    assert(file.includes('...installationGuardArguments()'));
    assert(file.includes('be.sportgreenmoove.app.local.test/${disposableTestRunner}'));
    assert(!file.includes('local.test/androidx.test.runner.AndroidJUnitRunner'));
  }
  assert.deepEqual(installationGuardArguments({}), []);
  assert.deepEqual(installationGuardArguments({ SGM_BLOCK_TEST_PHONE_INSTALLS: 'true' }), ['-e', 'sgmBlockInstallations', 'true']);
  assert.throws(() => installationGuardArguments({ SGM_BLOCK_TEST_PHONE_INSTALLS: 'yes' }));
});
test('only disposable workflows opt in, and both native/web gates exercise the policy tests', () => {
  for (const name of ['native-ci.yml', 'native-real-maps-ui.yml']) {
    const source = read('.github/workflows/' + name);
    assert(source.includes('SGM_BLOCK_TEST_PHONE_INSTALLS: "true"'));
    assert(source.includes('SGM_LOCAL_DISPOSABLE_EMULATOR: "true"'));
    assert(source.includes('SGM_TEST_PHONE_ADMIN_APPROVED: "true"'));
  }
  for (const name of ['native-ci.yml', 'web-integration-smoke.yml'])
    assert(read('.github/workflows/' + name).includes('node --test tests/disposable-installations.test.mjs'));
  const wrapper = read('scripts/run-android-ui-tests-and-collect-screenshots.sh');
  assert(wrapper.includes('-Pandroid.testInstrumentationRunnerArguments.sgmBlockInstallations=true'));
  assert(wrapper.indexOf('verify-disposable-installations.mjs') < wrapper.indexOf('collect_component_evidence()'));
});

test('the previous runtime mutation stays a failed run with original receipts and hashes', () => {
  const base = 'docs/release/evidence/disposable-installation-guard-2026-10-18/previous-failure/';
  const hashes = JSON.parse(read(base + 'artifact-sha256.json'));
  assert.equal(Object.keys(hashes).length, 5);
  for (const [file, hash] of Object.entries(hashes))
    assert.equal(createHash('sha256').update(readFileSync(new URL('../' + base + file, import.meta.url))).digest('hex'), hash);
  const suite = new XMLParser({ ignoreAttributes: false }).parse(read(base + 'ordinary-tests.xml')).testsuite;
  assert.equal(Number(suite['@_tests']), 122); assert.equal(Number(suite['@_failures']), 1);
  assert.equal(Number(suite['@_errors']), 0); assert.equal(Number(suite['@_skipped']), 34);
  assert(read(base + 'ordinary-tests.xml').includes('Process crashed'));
  const setup = JSON.parse(read(base + 'disposable-device-setup.json'));
  assert.equal(setup.storePause.mapsRuntime.playServicesVersion, '24.23.35');
  assert.equal(Object.hasOwn(setup.storePause, 'installationPolicy'), false);
  const restored = JSON.parse(read(base + 'disposable-store-restore.json'));
  assert.equal(restored.restored, true); assert.equal(restored.verified, false);
  const log = read(base + 'native-job.log');
  assert(log.includes('Maps runtime changed during the test'));
  assert(log.includes("playServicesVersion: '26.40.32'"));
  assert.equal(JSON.parse(read(base + 'native-suite-status.json')).localReplay, 1);
});

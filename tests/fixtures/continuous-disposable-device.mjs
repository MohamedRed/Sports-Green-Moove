import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { pinnedApkHashes } from '../../scripts/qa/preinstalled-disposable-apks.mjs';
import { prepareContinuousDevice } from '../../scripts/qa/continuous-disposable-device.mjs';
import { installAdminComponent, installAdminPackage } from '../../scripts/qa/disposable-install-admin.mjs';
import { playServicesVersionCommand } from '../../scripts/qa/android-maps-prerequisites.mjs';
import { storeStateCommand } from '../../scripts/qa/disposable-store-pause.mjs';
import { packagesForCase, assertMatrixApkMetadata } from '../../scripts/qa/android-case-apks.mjs';

const launcher = 'com.google.android.apps.nexuslauncher';
export const approvalKeys = ['SGM_LOCAL_DISPOSABLE_EMULATOR', 'SGM_PAUSE_TEST_PHONE_STORE',
  'SGM_BLOCK_TEST_PHONE_INSTALLS', 'SGM_TEST_PHONE_ADMIN_APPROVED'];

export function continuousFixture(t, options = {}) {
  const directory = mkdtempSync(resolve(tmpdir(), 'sgm-continuous-unit-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const android = resolve(directory, 'android');
  const selectedCase = options.case ?? 'native-startup', packages = packagesForCase(selectedCase);
  for (const [name, path] of Object.entries(packages)) {
    const file = resolve(android, 'app/build/outputs', path);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, `unit-test APK bytes for ${name}`);
    writeFileSync(resolve(dirname(file), 'output-metadata.json'), JSON.stringify({ applicationId: name,
      artifactType: { type: 'APK' }, elements: [{ type: 'SINGLE', filters: [], outputFile: path.split('/').at(-1) }] }));
  }
  const hashes = pinnedApkHashes(android, packages), events = [];
  const state = { blocked: false, owner: false, launcher: true, stopped: options.originalStopped ?? false,
    version: '24.23.35', location: 'true', installed: new Set(),
    background: { RUN_IN_BACKGROUND: 'allow', RUN_ANY_IN_BACKGROUND: 'default' },
    installs: 'Active install sessions:\nHistorical install sessions:\n' };
  const env = { ...Object.fromEntries(approvalKeys.map((key) => [key, 'true'])),
    SGM_FOCUSED_UI_CASE: selectedCase, SGM_PREINSTALLED_TEST_APKS_RECEIPT: resolve(directory, 'receipt.json'),
    ...(selectedCase === 'full-matrix' ? { GITHUB_ACTIONS: 'true', RUNNER_OS: 'Linux' } : {}) };
  const record = (kind, args) => {
    const event = { kind, args, command: args.join(' '), blocked: state.blocked };
    events.push(event);
    options.before?.(event, state);
    return event;
  };
  const packagePath = (name) => `/data/app/sgm-${name}/base.apk`;
  const shell = (...args) => {
    const { command } = record('shell', args);
    if (command === 'getprop ro.kernel.qemu') return '1';
    if (command === 'getprop ro.build.version.sdk') return '35';
    if (command === 'am get-current-user') return '0';
    if (command === 'pm get-user-restriction --user 0 no_install_apps') return String(state.blocked);
    if (command === 'dumpsys package installs') return state.installs;
    if (command === 'dpm list-owners') return state.owner
      ? `1 owner:\nUser  0: admin=${installAdminComponent},DeviceOwner` : 'no owners';
    if (command === playServicesVersionCommand) return `versionName=${state.version}`;
    if (command === 'cmd location is-location-enabled --user 0') return state.location;
    if (command === storeStateCommand) return `User 0: installed=true stopped=${state.stopped}`;
    if (command === `pm list packages --user 0 ${Object.keys(packages)[0]}`)
      return [...state.installed].map((name) => `package:${name}`).join('\n');
    if (command.startsWith('pm list packages ')) {
      const name = args.at(-1), enabled = name !== launcher || state.launcher;
      return enabled === (args.includes('-e')) ? `package:${name}` : '';
    }
    if (command.startsWith('cmd appops get ')) {
      const operation = args.at(-1);
      return `${operation}: ${state.background[operation]}`;
    }
    if (command.startsWith('cmd appops set ')) {
      state.background[args.at(-2)] = args.at(-1); return '';
    }
    if (command.startsWith('am force-stop ')) { state.stopped = !options.storeWakes; return ''; }
    if (command.startsWith('pm unstop ')) { state.stopped = false; return ''; }
    if (command.startsWith('pm path ')) {
      assert(state.installed.has(args[2]), 'Android pm path exits nonzero for an absent package');
      return state.paths?.[args[2]] ?? `package:${packagePath(args[2])}`;
    }
    if (command.startsWith('sha256sum ')) {
      const name = Object.keys(packages).find((key) => packagePath(key) === args[1]);
      assert(name, 'Only pinned APK digests may be requested');
      return state.digestOutput ?? `${state.digests?.[name] ?? hashes[name]}  ${args[1]}`;
    }
    if (command.startsWith('am broadcast ')) {
      state.blocked = args.at(-1) === 'true';
      return `Broadcast completed: result=-1, data="SGM_INSTALL_BLOCKED=${state.blocked}"`;
    }
    if (command.startsWith('pm disable-user ')) { state.launcher = false; return ''; }
    if (command.startsWith('pm enable ')) { state.launcher = true; return ''; }
    if (command.startsWith('pm clear ')) {
      assert(state.installed.has(args[2])); return 'Success';
    }
    throw new Error(`Unexpected fake shell command: ${command}`);
  };
  const device = { serial: 'emulator-5554', shell, command: (...args) => {
    record('command', args);
    assert.equal(args[0], 'install'); assert.equal(args[1], '-t');
    assert.equal(state.blocked, false, 'No installer may run after guard activation');
    const name = Object.entries(packages).find(([, path]) => args[2].endsWith(path))?.[0];
    assert(name, 'Only pinned APKs may be installed');
    state.installed.add(name); return 'Success';
  } };
  const execute = () => { assert.fail('A unit test must never execute a host/device command'); };
  const deps = { device, hashes: (_android, selected) => pinnedApkHashes(android, selected),
    verifyMetadata: (_android, name) => assertMatrixApkMetadata(android, name),
    prepareAdmin: () => {
      record('prepareAdmin', []); state.owner = true;
      return { packageName: installAdminPackage, originalBlocked: false, policyReady: true, noAccounts: true };
    },
    removeAdmin: () => {
      record('removeAdmin', []); state.owner = false; state.blocked = false;
      return { authorizationRemoved: true, componentRemoved: true, originalPolicyRestored: true };
    },
    reset: () => { record('reset', []); state.installed.clear(); },
  };
  const prepare = () => prepareContinuousDevice(env, execute, deps);
  const save = (receipt) => writeFileSync(env.SGM_PREINSTALLED_TEST_APKS_RECEIPT, JSON.stringify(receipt));
  const prepareAndSave = () => { const receipt = prepare(); save(receipt); return receipt; };
  return { directory, android, hashes, events, state, env, device, execute, deps, prepare, save, prepareAndSave };
}

export function assertNoGuardedInstallOrUnlock(events) {
  const lock = events.findIndex(({ command }) => command.includes('SET_BLOCKED --ez blocked true'));
  assert(lock >= 0, 'The test must reach guard activation');
  for (const event of events.slice(lock + 1)) {
    assert.notEqual(event.kind, 'command', 'No installer may run after guard activation');
    assert(!event.command.includes('SET_BLOCKED --ez blocked false'), 'No installation window is permitted');
  }
}

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { assertNetworkStartReceipt } from '../scripts/qa/network-start-evidence.mjs';

const read = (file) => readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const native = (name) => read(`android/app/src/androidTest/java/be/sportgreenmoove/app/ui/${name}.kt`);
function complete() {
  return { projectId: 'demo-sgm-local-qa', runId: 'a'.repeat(32), scope: 'native-ui-with-disposable-os-network-control',
    completed: true, initialNetworkObservationVersion: 1, initialNetwork: {
      phase: 'initial', wifiEnabled: true, mobileDataEnabled: true, activeNetwork: true, backendReachable: true,
      wifiRequestRegistered: false, cellularRequestRegistered: false, userUnlocked: true,
      hasDefaultDataSubscription: true, simState: 5, deviceProvisionedSetting: '1', userSetupCompleteSetting: '1',
    } };
}

test('a newly completed replay requires the actual initial observation before transport requests', () => {
  assertNetworkStartReceipt(complete());
  for (const field of ['wifiEnabled', 'mobileDataEnabled', 'activeNetwork', 'backendReachable']) {
    const ui = complete(); ui.initialNetwork[field] = false;
    assert.throws(() => assertNetworkStartReceipt(ui), field);
  }
  for (const field of ['wifiRequestRegistered', 'cellularRequestRegistered']) {
    const ui = complete(); ui.initialNetwork[field] = true;
    assert.throws(() => assertNetworkStartReceipt(ui), field);
  }
});

test('incomplete, missing, stale or non-isolated initial observations cannot pass fresh verification', () => {
  for (const patch of [{ completed: false }, { initialNetwork: undefined }, { initialNetworkObservationVersion: undefined },
    { initialNetworkObservationVersion: 2 }, { projectId: 'sports-green-moove-prod' }, { runId: 'old' }])
    assert.throws(() => assertNetworkStartReceipt({ ...complete(), ...patch }));
  const ui = complete(); ui.initialNetwork.phase = 'restored'; assert.throws(() => assertNetworkStartReceipt(ui));
});

test('diagnostic setup and SIM states are recorded without turning unknowns into a fabricated ready value', () => {
  const ui = complete(); ui.initialNetwork.deviceProvisionedSetting = null;
  ui.initialNetwork.userSetupCompleteSetting = '0'; ui.initialNetwork.simState = 0;
  ui.initialNetwork.hasDefaultDataSubscription = false; assertNetworkStartReceipt(ui);
  for (const patch of [{ deviceProvisionedSetting: undefined }, { userSetupCompleteSetting: 'assumed' },
    { userUnlocked: undefined }, { hasDefaultDataSubscription: undefined }, { simState: -1 }, { simState: 12 }]) {
    const changed = complete(); Object.assign(changed.initialNetwork, patch);
    assert.throws(() => assertNetworkStartReceipt(changed));
  }
});

test('recording occurs after isolated-target guards and before requests or radio mutation', () => {
  const control = native('LocalEmulatorNetwork'), helper = native('LocalNetworkStartObservation');
  assert(control.indexOf('requireLocalNetworkStart(initial, recordStart)') > control.indexOf('getprop ro.kernel.qemu'));
  assert(control.indexOf('requireLocalNetworkStart(initial, recordStart)') < control.indexOf('wireless.start()'));
  assert.match(helper, /val wifi[\s\S]*record\(JSONObject\(sample.toString\(\)\)\)[\s\S]*check\(wifi && data\)/);
  assert.match(helper, /check\(connected\)/); assert.match(helper, /check\(reachable\)/);
  assert(!/svc |settings put|setDataEnabled|setWifiEnabled|requestNetwork|sleep|repeat\(/.test(helper));
  for (const method of ['getSimSerialNumber', 'getSubscriberId', 'getLine1Number', 'getImei', 'getDeviceId'])
    assert(!control.includes(method), method);
  assert(control.includes('UserManager::class.java).isUserUnlocked'));
});

test('constructor failures have the right phase and persist an initial record without replacing handover proof', () => {
  const flow = native('LocalChatNetworkFlowTest');
  const constructor = flow.indexOf('val control = LocalEmulatorNetwork(');
  assert(flow.indexOf('phase = "network-preconditions"') < constructor);
  assert(flow.indexOf('result.put("initialNetwork", initial)', constructor) < flow.indexOf('control.use {', constructor));
  assert(flow.indexOf('writeResult(context, result)', constructor) < flow.indexOf('control.use {', constructor));
  assert(flow.includes('result.put("initialNetworkObservationVersion", 1)'));
  const verifier = read('scripts/qa/local-chat-network-ui.mjs');
  for (const required of ['assertChatNetworkReceipt(ui)', 'assertTransportRequestSetup(ui)', 'assertNetworkStartReceipt(ui)'])
    assert(verifier.includes(required));
});

test('read-only capability observations retain validation separately without changing network acceptance', () => {
  const control = native('LocalEmulatorNetwork'), helper = native('LocalNetworkCapabilitySnapshot');
  assert(control.includes('localNetworkCapabilitySnapshot(activeCapabilities, available, SystemClock.elapsedRealtime())'));
  assert(helper.includes('"atomicObservation", false'));
  for (const capability of ['INTERNET', 'VALIDATED', 'CAPTIVE_PORTAL', 'NOT_SUSPENDED', 'NOT_METERED', 'TRUSTED'])
    assert(helper.includes('hasCapability(NetworkCapabilities.NET_CAPABILITY_' + capability + ')'));
  assert(helper.includes('active?.let(::describe) ?: JSONObject.NULL'));
  assert(helper.includes('localNetworkCapabilityDescription(capabilities::hasCapability, capabilities::hasTransport)'));
  assert(read('scripts/qa/local-chat-network-recovery-ui.mjs').includes("'LocalNetworkCapabilitySnapshot.kt'"));
  for (const forbidden of ['.toString()', '.transportInfo', 'getLinkProperties', 'requestNetwork', 'bindProcessToNetwork',
    'executeShellCommand', 'Thread.sleep', 'repeat(']) assert(!helper.includes(forbidden), forbidden);
  assert(!native('LocalInitialNetworkObservation').includes('capabilityObservation'));
  assert(!native('LocalCellularObservation').includes('capabilityObservation'));
  const cases = native('LocalNetworkCapabilitySnapshotTest');
  assert.equal((cases.match(/@Test fun /g) ?? []).length, 4);
  for (const name of ['LocalNetworkCapabilitySnapshot', 'LocalNetworkCapabilitySnapshotTest', 'LocalEmulatorNetwork'])
    assert(native(name).split('\n').length < 300, name);
});

test('native and web gates cover the initial observation while all new native modules remain small', () => {
  const file = 'tests/network-start-observation.test.mjs';
  for (const name of ['native-ci.yml', 'web-integration-smoke.yml']) {
    const workflow = read('.github/workflows/' + name);
    assert.equal(workflow.split('"' + file + '"').length - 1, 2); assert(workflow.includes('node --test ' + file));
  }
  assert(read('.github/workflows/backend-ci.yml').includes('node --test ' + file));
  for (const name of ['LocalNetworkStartObservation', 'LocalNetworkStartObservationTest', 'LocalEmulatorNetwork', 'LocalChatNetworkFlowTest'])
    assert(native(name).split('\n').length < 300, name);
});

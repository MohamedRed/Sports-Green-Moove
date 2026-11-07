import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { assertChatNetworkReceipt, assertTransportRequestSetup } from '../scripts/qa/chat-network-evidence.mjs';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const native = (name) => read(`android/app/src/androidTest/java/be/sportgreenmoove/app/ui/${name}.kt`);
function complete() {
  const connected = { wifiEnabled: true, mobileDataEnabled: true, activeNetwork: true, backendReachable: true,
    internetNetworkCount: 2, activeInternetTransports: ['wifi'], internetTransports: ['wifi', 'cellular'],
    wifiRequestRegistered: true, cellularRequestRegistered: true };
  const ui = { projectId: 'demo-sgm-local-qa', runId: 'a'.repeat(32), scope: 'native-ui-with-disposable-os-network-control',
    completed: true, setupMethod: 'requested-wifi-and-cellular-networks', transportSetupVersion: 2,
    handoverObservationVersion: 1, wifiRequestReleased: true, cellularRequestReleased: true,
    offlineSendUnconfirmed: true, offlineDraftRetained: true, recoveredSendConfirmed: true, accountDraftCleared: true, replyReceived: true,
    preparation: { phase: 'preparing', wifiRequestRegistered: true, cellularRequestRegistered: true },
    network: [{ phase: 'before', ...connected },
      { phase: 'cellular-ready', ...connected, wifiEnabled: false, internetNetworkCount: 1,
        activeInternetTransports: ['cellular'], internetTransports: ['cellular'] },
      { phase: 'offline', ...connected, wifiEnabled: false, mobileDataEnabled: false, activeNetwork: false,
        backendReachable: false, internetNetworkCount: 0, activeInternetTransports: [], internetTransports: [] },
      { phase: 'restored', ...connected }] };
  return structuredClone(ui);
}
const validate = (ui) => { assertChatNetworkReceipt(ui); assertTransportRequestSetup(ui); };

test('fresh dual-radio proof requires actual Wi-Fi before handover and after restoration', () => {
  validate(complete());
  for (const index of [0, 3]) {
    for (const changes of [{ internetNetworkCount: 1, internetTransports: ['cellular'], activeInternetTransports: ['cellular'] },
      { activeInternetTransports: ['cellular'] }, { internetTransports: ['wifi'] }, { internetTransports: ['wifi', 'cellular', 'vpn'] },
      { wifiEnabled: false }, { mobileDataEnabled: false }, { backendReachable: false }, { wifiRequestRegistered: false }]) {
      const run = complete(); Object.assign(run.network[index], changes); assert.throws(() => validate(run));
    }
  }
});

test('fresh verifier rejects legacy setup, leaked requests and weaker offline or cellular states', () => {
  for (const mutate of [(run) => { run.setupMethod = 'requested-cellular-network'; },
    (run) => { delete run.transportSetupVersion; }, (run) => { run.transportSetupVersion = 1; },
    (run) => { run.wifiRequestReleased = false; }, (run) => { run.cellularRequestReleased = false; },
    (run) => { run.preparation.wifiRequestRegistered = false; }, (run) => { run.network[2].wifiRequestRegistered = false; },
    (run) => { run.network[1].internetTransports.push('wifi'); }, (run) => { run.network[2].backendReachable = true; },
    (run) => { run.network[2].activeNetwork = true; }, (run) => { run.completed = false; }]) {
    const run = complete(); mutate(run); assert.throws(() => validate(run));
  }
});

test('both standard transport requests are guarded and released without routes, specifiers or device settings', () => {
  const control = native('LocalEmulatorNetwork'), request = native('LocalRequestedTransport');
  assert(control.indexOf('wireless.start()') > control.indexOf('getprop ro.kernel.qemu'));
  assert(control.includes('finishLocalNetworkCleanup(failure, cellular::close, wireless::close)'));
  assert(control.includes('finishLocalNetworkCleanup(null, ::restore, cellular::close, wireless::close)'));
  assert(request.includes('connectivity.requestNetwork(request, callback)'));
  assert(!/NetworkSpecifier|bindProcessToNetwork|setProcessDefaultNetwork|settings put|connect-network|startScan/.test(control + request));
  const flow = native('LocalChatNetworkFlowTest');
  for (const marker of ['preparedEvidence = control.preparedSnapshot()', 'network.put(checkNotNull(preparedEvidence))',
    'restoredEvidence = control.restoredSnapshot()', 'network.put(checkNotNull(restoredEvidence))',
    'assertFalse("The Wi-Fi test request must be released", control.wifiRequestRegistered)']) assert(flow.includes(marker));
  assert(!flow.includes('control.snapshot("before")') && !flow.includes('control.snapshot("restored")'));
  assert.match(flow, /compose.waitUntil\(30_000\) \{\s*restoredEvidence = control.restoredSnapshot\(\)/);
  assert(flow.includes('waitForText("Envoi non confirmé. Réessayez.", 90_000)'));
});

test('CI and the local isolation command cover the new contract without oversized native modules', () => {
  for (const file of ['.github/workflows/native-ci.yml', '.github/workflows/web-integration-smoke.yml']) {
    const source = read(file);
    assert.equal(source.split('"tests/dual-transport-config.test.mjs"').length - 1, 2);
    assert(source.includes('run: node --test tests/dual-transport-config.test.mjs'));
  }
  assert(JSON.parse(read('package.json')).scripts['test:local-flow-isolation'].includes('tests/dual-transport-config.test.mjs'));
  for (const name of ['LocalRequestedTransport', 'LocalInitialNetworkObservation', 'LocalEmulatorNetwork',
    'LocalChatNetworkFlowTest', 'LocalNetworkCleanupTest', 'LocalInitialNetworkObservationTest']) assert(native(name).split('\n').length < 300, name);
});

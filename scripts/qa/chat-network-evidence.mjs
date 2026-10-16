import assert from 'node:assert/strict';

export function assertChatNetworkReceipt(ui) {
  assert.equal(ui.scope, 'native-ui-with-disposable-os-network-control');
  assert.equal(ui.projectId, 'demo-sgm-local-qa');
  assert.match(ui.runId, /^[a-f0-9]{32}$/);
  assert.equal(ui.completed, true);
  for (const key of ['offlineSendUnconfirmed', 'offlineDraftRetained', 'recoveredSendConfirmed', 'accountDraftCleared', 'replyReceived']) {
    assert.equal(ui[key], true, `The app replay must prove ${key}`);
  }
  const phases = ui.network.map((state) => state.phase);
  const hasHandover = phases.includes('cellular-ready');
  assert.deepEqual(phases, hasHandover ? ['before', 'cellular-ready', 'offline', 'restored'] : ['before', 'offline', 'restored']);
  const before = ui.network[0], offline = ui.network.at(-2), restored = ui.network.at(-1);
  for (const state of ui.network) {
    for (const key of ['wifiEnabled', 'mobileDataEnabled', 'activeNetwork', 'backendReachable']) {
      assert.equal(typeof state[key], 'boolean');
    }
    assert(Number.isInteger(state.internetNetworkCount) && state.internetNetworkCount >= 0);
  }
  assert(before.activeNetwork && before.backendReachable && before.internetNetworkCount > 0);
  if (hasHandover) {
    const cellular = ui.network[1];
    assert(before.mobileDataEnabled && cellular.mobileDataEnabled && cellular.activeNetwork && cellular.backendReachable);
    assert.equal(cellular.wifiEnabled, false);
    assert(cellular.internetNetworkCount > 0 && cellular.internetTransports.includes('cellular'));
    assert(!cellular.internetTransports.includes('wifi'));
  }
  assert.equal(offline.activeNetwork, false); assert.equal(offline.internetNetworkCount, 0);
  assert.equal(offline.wifiEnabled, false); assert.equal(offline.mobileDataEnabled, false);
  assert.equal(offline.backendReachable, false);
  assert(restored.activeNetwork && restored.backendReachable && restored.internetNetworkCount > 0);
  assert.equal(restored.wifiEnabled, before.wifiEnabled);
  assert.equal(restored.mobileDataEnabled, before.mobileDataEnabled);
}

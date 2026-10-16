import assert from 'node:assert/strict';

export function assertChatNetworkReceipt(ui) {
  assert.equal(ui.scope, 'native-ui-with-disposable-os-network-control');
  assert.equal(ui.projectId, 'demo-sgm-local-qa');
  assert.equal(ui.completed, true);
  for (const key of ['offlineSendUnconfirmed', 'offlineDraftRetained', 'recoveredSendConfirmed', 'accountDraftCleared', 'replyReceived']) {
    assert.equal(ui[key], true, `The app replay must prove ${key}`);
  }
  assert.deepEqual(ui.network.map((state) => state.phase), ['before', 'offline', 'restored']);
  const [before, offline, restored] = ui.network;
  for (const state of ui.network) {
    for (const key of ['wifiEnabled', 'mobileDataEnabled', 'activeNetwork', 'backendReachable']) {
      assert.equal(typeof state[key], 'boolean');
    }
    assert(Number.isInteger(state.internetNetworkCount) && state.internetNetworkCount >= 0);
  }
  assert(before.activeNetwork && before.backendReachable && before.internetNetworkCount > 0);
  assert.equal(offline.activeNetwork, false); assert.equal(offline.internetNetworkCount, 0);
  assert.equal(offline.wifiEnabled, false); assert.equal(offline.mobileDataEnabled, false);
  assert.equal(offline.backendReachable, false);
  assert(restored.activeNetwork && restored.backendReachable && restored.internetNetworkCount > 0);
  assert.equal(restored.wifiEnabled, before.wifiEnabled);
  assert.equal(restored.mobileDataEnabled, before.mobileDataEnabled);
}

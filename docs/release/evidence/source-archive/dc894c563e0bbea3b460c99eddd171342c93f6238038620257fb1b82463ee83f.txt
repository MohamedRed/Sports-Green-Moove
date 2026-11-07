import assert from 'node:assert/strict';

export function assertNetworkStartReceipt(ui) {
  assert.equal(ui.scope, 'native-ui-with-disposable-os-network-control');
  assert.equal(ui.projectId, 'demo-sgm-local-qa');
  assert.match(ui.runId, /^[a-f0-9]{32}$/);
  assert.equal(ui.completed, true);
  assert.equal(ui.initialNetworkObservationVersion, 1);
  const initial = ui.initialNetwork;
  assert.equal(initial.phase, 'initial');
  for (const key of ['wifiEnabled', 'mobileDataEnabled', 'activeNetwork', 'backendReachable'])
    assert.equal(initial[key], true, `Initial ${key} must be measured before transport requests`);
  assert.equal(initial.wifiRequestRegistered, false);
  assert.equal(initial.cellularRequestRegistered, false);
  assert.equal(typeof initial.userUnlocked, 'boolean');
  assert.equal(typeof initial.hasDefaultDataSubscription, 'boolean');
  assert(Number.isInteger(initial.simState) && initial.simState >= 0 && initial.simState <= 11);
  for (const key of ['deviceProvisionedSetting', 'userSetupCompleteSetting'])
    assert([null, '0', '1'].includes(initial[key]), 'A platform setup setting must be recorded, not inferred');
}

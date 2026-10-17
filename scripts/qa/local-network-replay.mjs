import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { finishDisposableCleanup, waitForDisposableDevice } from './disposable-device-cleanup.mjs';
import { collectDisposableModem } from './local-modem-diagnostics.mjs';
import { collectDisposableSubscriptions } from './local-subscription-diagnostics.mjs';

const receiptPath = '/sdcard/Android/data/be.sportgreenmoove.app.local/files/local-ui-evidence/local-chat-network-ui.json';
const commandOptions = { encoding: 'utf8', timeout: 30_000 };

export function networkRestoreCommands(receipt, runId) {
  assert.equal(receipt.projectId, 'demo-sgm-local-qa');
  assert.equal(receipt.scope, 'native-ui-with-disposable-os-network-control');
  assert.match(runId, /^[a-f0-9]{32}$/);
  assert.equal(receipt.runId, runId);
  assert(Array.isArray(receipt.network));
  if (receipt.network.length === 0) return [];
  const original = receipt.network[0];
  assert.equal(original.phase, 'before');
  for (const key of ['wifiEnabled', 'mobileDataEnabled']) assert.equal(typeof original[key], 'boolean');
  return [['wifi', original.wifiEnabled], ['data', original.mobileDataEnabled]]
    .map(([service, enabled]) => ['shell', 'svc', service, enabled ? 'enable' : 'disable']);
}

export function replayWithNetworkCleanup(adb, serial, runId, instrument) {
  assert.equal(process.env.SGM_LOCAL_DISPOSABLE_EMULATOR, 'true');
  assert(/^emulator-\d+$/.test(serial));
  assert.match(runId, /^[a-f0-9]{32}$/);
  assert.equal(execFileSync(adb, ['-s', serial, 'shell', 'getprop', 'ro.kernel.qemu'], commandOptions).trim(), '1');
  execFileSync(adb, ['-s', serial, 'shell', 'rm', '-f', receiptPath], commandOptions);
  const collectModem = (phase) => collectDisposableModem(adb, serial, runId, phase, process.env.SGM_LOCAL_UI_OUTPUT);
  const collectSubscriptions = (phase) => collectDisposableSubscriptions(adb, serial, runId, phase, process.env.SGM_LOCAL_UI_OUTPUT);
  let failure;
  try {
    collectModem('before');
    collectSubscriptions('before');
    instrument(['LocalChatNetworkFlowTest'], 1);
  }
  catch (error) { failure = error; }
  finally {
    finishDisposableCleanup(failure, [() => collectModem('after'), () => collectSubscriptions('after'), () => {
      waitForDisposableDevice(adb, serial);
      const exists = spawnSync(adb, ['-s', serial, 'shell', 'test', '-f', receiptPath], commandOptions);
      assert([0, 1].includes(exists.status), 'The disposable device must remain available for cleanup');
      assert.equal(exists.stderr?.trim() ?? '', '', 'Receipt presence must not hide a transport error');
      if (exists.status === 0) {
        const receipt = JSON.parse(execFileSync(adb, ['-s', serial, 'shell', 'cat', receiptPath], commandOptions));
        const commands = networkRestoreCommands(receipt, runId);
        if (commands.length) {
          finishDisposableCleanup(undefined, commands.map((command) => () => {
            waitForDisposableDevice(adb, serial);
            execFileSync(adb, ['-s', serial, ...command], commandOptions);
          }));
        }
      }
    }]);
  }
}

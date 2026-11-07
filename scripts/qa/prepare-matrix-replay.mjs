import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { isAbsolute } from 'node:path';
import { requireFocusedDeviceApproval, assertContinuousDevice, assertPinnedApks, pinnedApkHashes, usePreinstalledTestApks } from './preinstalled-disposable-apks.mjs';
import { matrixPackages, ordinaryPackages, pinnedPackages } from './android-case-apks.mjs';
import { disposableAndroidShell } from './disposable-android-shell.mjs';

function stopOrdinaryProcesses(shell) {
  const packages = Object.keys(ordinaryPackages);
  const inventory = () => {
    const raw = shell('ps', '-A', '-w', '-o', 'NAME');
    assert(typeof raw === 'string' && Buffer.byteLength(raw) <= 65536, 'Bounded process inventory required');
    const names = raw.trim().split('\n').map(name => name.trim());
    assert(names.shift() === 'NAME' && names.length > 0 && names.every(name => /^[^\s\0]+$/.test(name)),
      'Process inventory format unavailable; the next stage must not start');
    return packages.map(pkg => names.filter(name => name === pkg || name.startsWith(pkg + ':')).length);
  };
  const before = inventory();
  for (const name of [...packages].reverse()) shell('am', 'force-stop', name);
  const after = inventory();
  assert(after.every(count => count === 0), 'Ordinary workers remain alive; the next stage must not start');
  return { scope: 'ordinary-matrix-process-stop-not-flow-proof', packages: packages.map((packageName, index) => ({
    packageName, beforeCount: before[index], afterCount: after[index],
  })) };
}

export function usePreinstalledMatrixReplay(env = process.env) {
  if (env.SGM_FOCUSED_UI_CASE === undefined && env.SGM_PREINSTALLED_TEST_APKS_RECEIPT === undefined) return false;
  assert.equal(env.SGM_FOCUSED_UI_CASE, 'full-matrix', 'Never ignore a partial or different preinstalled selection');
  assert.equal(usePreinstalledTestApks(env), true);
  return true;
}

export function prepareMatrixReplay({ android, serial, env = process.env, device = disposableAndroidShell(env) }) {
  assert.equal(env.SGM_FOCUSED_UI_CASE, 'full-matrix'); requireFocusedDeviceApproval(env);
  const path = env.SGM_PREINSTALLED_TEST_APKS_RECEIPT; assert(path && isAbsolute(path));
  const raw = readFileSync(path), receipt = JSON.parse(raw);
  assert.equal(receipt.case, 'full-matrix'); assert.equal(serial, device.serial);
  assert.equal(readFileSync(path + '.claimed', 'utf8'), 'full-matrix\n', 'The ordinary matrix must claim the same preinstalled APK set first');
  assertContinuousDevice(device, receipt);
  assert.deepEqual(pinnedApkHashes(android, matrixPackages), receipt.apkHashes);
  assertPinnedApks(device.shell, receipt.apkHashes, matrixPackages);
  writeFileSync(path + '.replay.claimed', 'full-matrix\n', { mode: 0o600, flag: 'wx' });
  // A timed-out host adb process does not establish that its guest instrumentation has exited.
  const ordinaryProcessStop = stopOrdinaryProcesses(device.shell);
  writeFileSync(path + '.replay-stopped.json', JSON.stringify(ordinaryProcessStop, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
  for (const name of Object.keys(pinnedPackages)) assert.equal(device.shell('pm', 'clear', name), 'Success');
  assertContinuousDevice(device, receipt); assertPinnedApks(device.shell, receipt.apkHashes, matrixPackages);
  return { method: 'preinstalled-full-matrix-replay-without-install-window', receiptSha256: createHash('sha256').update(raw).digest('hex'),
    installationsRemainedBlocked: true, apkHashes: receipt.apkHashes, ordinaryProcessStop };
}

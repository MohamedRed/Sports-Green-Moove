import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { isAbsolute } from 'node:path';
import { requireFocusedDeviceApproval, assertContinuousDevice, assertPinnedApks, pinnedApkHashes, usePreinstalledTestApks } from './preinstalled-disposable-apks.mjs';
import { matrixPackages, pinnedPackages } from './android-case-apks.mjs';
import { disposableAndroidShell } from './disposable-android-shell.mjs';

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
  for (const name of Object.keys(pinnedPackages)) assert.equal(device.shell('pm', 'clear', name), 'Success');
  assertContinuousDevice(device, receipt); assertPinnedApks(device.shell, receipt.apkHashes, matrixPackages);
  return { method: 'preinstalled-full-matrix-replay-without-install-window', receiptSha256: createHash('sha256').update(raw).digest('hex'),
    installationsRemainedBlocked: true, apkHashes: receipt.apkHashes };
}

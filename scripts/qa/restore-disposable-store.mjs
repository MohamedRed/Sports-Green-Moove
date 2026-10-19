import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { disposableAndroidShell } from './disposable-android-shell.mjs';
import { restoreDisposableAndroid } from './restore-disposable-android.mjs';

const receipt = JSON.parse(readFileSync(process.argv[2], 'utf8'));
assert.equal(receipt.scope, 'disposable-emulator-without-home-navigation');
if (receipt.storePause !== null) {
  const device = disposableAndroidShell();
  assert.equal(device.serial, receipt.serial, 'Restore refuses a different test phone');
  try { console.log(JSON.stringify(restoreDisposableAndroid(device, receipt))); }
  catch (failure) {
    if (failure.receipt) console.log(JSON.stringify(failure.receipt));
    throw failure;
  }
}

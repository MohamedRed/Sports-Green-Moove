import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { disposableAndroidShell } from './disposable-android-shell.mjs';
import { restoreDisposableStore } from './disposable-store-pause.mjs';

const receipt = JSON.parse(readFileSync(process.argv[2], 'utf8'));
assert.equal(receipt.scope, 'disposable-emulator-without-home-navigation');
if (receipt.storePause !== null) {
  const { serial, shell } = disposableAndroidShell();
  assert.equal(serial, receipt.serial, 'Restore refuses a different test phone');
  console.log(JSON.stringify(restoreDisposableStore(shell, receipt.storePause)));
}

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { disposableAndroidShell } from './disposable-android-shell.mjs';
import { assertNoActiveInstall, readInstallBlocked } from './disposable-installations.mjs';
import { androidMapsPrerequisites } from './android-maps-prerequisites.mjs';

const receipt = JSON.parse(readFileSync(process.argv[2], 'utf8'));
if (receipt.storePause?.installationPolicy) {
  const { serial, shell } = disposableAndroidShell();
  assert.equal(serial, receipt.serial);
  assert.equal(readInstallBlocked(shell), true, 'The test runner did not activate the approved installation guard');
  assertNoActiveInstall(shell);
  assert.deepEqual(androidMapsPrerequisites(shell), receipt.storePause.mapsRuntime, 'Maps runtime changed during the ordinary tests');
  console.log(JSON.stringify({ scope: 'disposable-test-phone', installationsBlocked: true, mapsRuntimeUnchanged: true }));
}

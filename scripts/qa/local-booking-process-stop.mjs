import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { waitForDisposableDevice } from './disposable-device-cleanup.mjs';

export function stopDisposableBookingProcess(adb, serial, runId, directory) {
  assert.equal(process.env.SGM_LOCAL_DISPOSABLE_EMULATOR, 'true');
  assert.match(serial, /^emulator-\d+$/); assert.match(runId, /^[a-f0-9]{32}$/); assert(isAbsolute(directory));
  waitForDisposableDevice(adb, serial);
  const appId = 'be.sportgreenmoove.app.local', options = { encoding: 'utf8', timeout: 30_000 };
  const shell = (...args) => execFileSync(adb, ['-s', serial, 'shell', ...args], options);
  let session;
  try { session = JSON.parse(shell('run-as', appId, 'cat', 'files/local-qa-session.json')); }
  catch { throw new Error('Cannot validate the isolated booking session'); }
  assert.equal(session.projectId, 'demo-sgm-local-qa'); assert.equal(session.runId, runId);
  assert.equal(session.disposableEmulator, true);
  const before = JSON.parse(shell('cat', `/sdcard/Android/data/${appId}/files/local-ui-evidence/local-booking-loss-before.json`));
  assert.equal(before.projectId, session.projectId); assert.equal(before.runId, runId);
  assert.equal(before.scope, 'native-sdk-booking-response-loss-not-ui');
  assert.equal(before.replyUnconfirmed, true); assert.equal(before.pendingIdentityPersisted, true);
  assert(Number.isInteger(before.processId) && before.processId > 0);
  const pid = () => {
    const result = spawnSync(adb, ['-s', serial, 'shell', 'pidof', appId], options);
    assert([0, 1].includes(result.status)); assert.equal(result.stderr?.trim() ?? '', '');
    if (result.status === 1) { assert.equal(result.stdout?.trim() ?? '', ''); return null; }
    assert.match(result.stdout.trim(), /^[1-9]\d*$/); return Number(result.stdout.trim());
  };
  const observedBeforePid = pid();
  assert(observedBeforePid === null || observedBeforePid === before.processId);
  shell('am', 'force-stop', appId);
  assert.equal(pid(), null);
  const stopped = { projectId: session.projectId, runId, scope: 'disposable-local-app-force-stop', appId,
    preparedProcessId: before.processId, observedBeforePid, forceStopIssued: true, noProcessAfterStop: true };
  writeFileSync(resolve(directory, 'local-booking-loss-stop.json'), `${JSON.stringify(stopped, null, 2)}\n`);
  return stopped;
}

import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { waitForDisposableDevice } from './disposable-device-cleanup.mjs';

const appId = 'be.sportgreenmoove.app.local';
const options = { encoding: 'utf8', timeout: 30_000 };
const preparations = new Set(['local-chat-restart-before.json', 'local-trip-consent-restart-before.json', 'local-trip-consent-recovery-before.json',
  'local-trip-draft-before.json', 'local-trip-schedule-draft-before.json', 'local-session-disconnect-before.json',
  'local-team-draft-before.json', 'local-team-draft-sent-before.json']);

export function stopDisposableAppProcess({ adb, serial, runId, outputDir, beforeName, validateBefore },
  { execute = execFileSync, spawn = spawnSync, write = writeFileSync } = {}) {
  assert.equal(process.env.SGM_LOCAL_DISPOSABLE_EMULATOR, 'true');
  assert.match(serial, /^emulator-\d+$/); assert.match(runId, /^[a-f0-9]{32}$/); assert(isAbsolute(outputDir));
  assert(preparations.has(beforeName)); assert.equal(typeof validateBefore, 'function');
  waitForDisposableDevice(adb, serial, execute);
  const shell = (...args) => execute(adb, ['-s', serial, 'shell', ...args], options);
  let session;
  try { session = JSON.parse(shell('run-as', appId, 'cat', 'files/local-qa-session.json')); }
  catch { throw new Error('Cannot read the isolated QA session; private session contents are not diagnostic output'); }
  assert.equal(session.projectId, 'demo-sgm-local-qa'); assert.equal(session.runId, runId);
  assert.equal(session.disposableEmulator, true);
  const before = JSON.parse(shell('cat', `/sdcard/Android/data/${appId}/files/local-ui-evidence/${beforeName}`));
  validateBefore(before, runId);
  const pid = () => {
    const result = spawn(adb, ['-s', serial, 'shell', 'pidof', appId], options);
    assert([0, 1].includes(result.status), 'Process inventory must not hide a device error');
    assert.equal(result.stderr?.trim() ?? '', '');
    const output = result.stdout?.trim() ?? '';
    if (result.status === 1) { assert.equal(output, ''); return null; }
    assert.match(output, /^[1-9]\d*$/); return Number(output);
  };
  const observedBeforePid = pid();
  assert(observedBeforePid === null || observedBeforePid === before.processId);
  shell('am', 'force-stop', appId);
  assert.equal(pid(), null, 'The isolated app must be fully stopped before the resume stage');
  const stopped = { projectId: session.projectId, runId, scope: 'disposable-local-app-force-stop',
    appId, preparedProcessId: before.processId, observedBeforePid, forceStopIssued: true, noProcessAfterStop: true };
  write(resolve(outputDir, beforeName), `${JSON.stringify(before, null, 2)}\n`, { flag: 'wx' });
  write(resolve(outputDir, beforeName.replace('-before.json', '-stop.json')), `${JSON.stringify(stopped, null, 2)}\n`, { flag: 'wx' });
  return stopped;
}

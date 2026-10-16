import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { waitForDisposableDevice } from './disposable-device-cleanup.mjs';

const states = new Set(['unregistered', 'home', 'roaming', 'searching', 'denied', 'off', 'on']);

export function parseModemStatus(output) {
  const result = {};
  for (const line of output.split(/\r?\n/).map((value) => value.trim()).filter(Boolean)) {
    if (line === 'OK') continue;
    const match = /^gsm (voice|data) state: (\w+)$/.exec(line);
    assert(match && states.has(match[2]), 'Unexpected modem status; do not persist unrecognized console output');
    assert(!Object.hasOwn(result, match[1]), 'Duplicate modem state');
    result[match[1]] = match[2];
  }
  assert.deepEqual(Object.keys(result).sort(), ['data', 'voice']);
  return result;
}

export function collectDisposableModem(adb, serial, runId, phase, outputDir,
  execute = execFileSync, write = writeFileSync) {
  assert.equal(process.env.SGM_LOCAL_DISPOSABLE_EMULATOR, 'true');
  assert.match(serial, /^emulator-\d+$/); assert.match(runId, /^[a-f0-9]{32}$/);
  assert(['before', 'after'].includes(phase)); assert(isAbsolute(outputDir));
  waitForDisposableDevice(adb, serial, execute);
  const status = parseModemStatus(execute(adb, ['-s', serial, 'emu', 'gsm', 'status'],
    { encoding: 'utf8', timeout: 30_000 }));
  const receipt = { projectId: 'demo-sgm-local-qa', runId, phase,
    scope: 'read-only-disposable-modem-registration', recordedAt: new Date().toISOString(), ...status };
  write(resolve(outputDir, `chat-modem-${phase}.json`), `${JSON.stringify(receipt, null, 2)}\n`);
  return receipt;
}

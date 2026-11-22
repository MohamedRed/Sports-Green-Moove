import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, isAbsolute } from 'node:path';
import assert from 'node:assert/strict';

export function retainLocalEmulatorLogs(runtimeDirectory, evidenceDirectory, password) {
  assert(isAbsolute(runtimeDirectory) && isAbsolute(evidenceDirectory));
  assert(typeof password === 'string' && password.length >= 16);
  const files = [];
  for (const name of ['firestore-debug.log', 'database-debug.log']) {
    const source = resolve(runtimeDirectory, name); if (!existsSync(source)) continue;
    const sanitized = readFileSync(source, 'utf8').replaceAll(password, '[REDACTED]')
      .replace(/AIza[\w-]{20,}|Bearer\s+[\w.~+/-]+=*|eyJ[\w-]+\.[\w-]+\.[\w-]*/g, '[REDACTED]');
    const file = `emulator-${name}.txt`;
    writeFileSync(resolve(evidenceDirectory, file), sanitized, { flag: 'wx', mode: 0o600 }); files.push(file);
  }
  return files;
}

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { totalmem, freemem, availableParallelism } from 'node:os';
import { packageOperationQueries } from './native-package-diagnostics.mjs';

export function collectNativeProcessFailure({ adb, serial, directory, label, password, runId }, execute = execFileSync) {
  assert.equal(process.env.SGM_LOCAL_DISPOSABLE_EMULATOR, 'true');
  assert.match(serial, /^emulator-\d+$/); assert.match(runId, /^[a-f0-9]{32}$/);
  assert(isAbsolute(directory)); assert(/^[A-Za-z0-9_#-]+$/.test(label));
  assert(typeof password === 'string' && password.length >= 16);
  const redact = (value) => String(value).replaceAll(password, '[REDACTED]')
    .replace(/AIza[\w-]{20,}|Bearer\s+[\w.~+/-]+=*|eyJ[\w-]+\.[\w-]+\.[\w-]*/g, '[REDACTED]');
  const queries = [
    ['crash', ['logcat', '-d', '-b', 'crash', '-v', 'brief']],
    ['exit-info', ['shell', 'dumpsys', 'activity', 'exit-info', 'be.sportgreenmoove.app.local']],
    ['process-log', ['logcat', '-d', '-b', 'main', '-b', 'system', '-t', '800', '-v', 'brief',
      'ActivityManager:I', 'AndroidRuntime:E', 'libc:F', 'lmkd:I', '*:S']],
    ['guest-memory', ['shell', 'cat', '/proc/meminfo']],
    ...packageOperationQueries,
  ];
  const records = [];
  for (const [kind, command, select = (output) => output] of queries) {
    try {
      const output = execute(adb, ['-s', serial, ...command], { encoding: 'utf8', timeout: 30_000, maxBuffer: 1024 * 1024 });
      const file = `${label}-${kind}.txt`;
      writeFileSync(resolve(directory, file), redact(select(output)), { mode: 0o600, flag: 'wx' });
      records.push({ kind, status: 'collected', file, empty: output.length === 0 });
    } catch (error) {
      records.push({ kind, status: 'failed', errorCode: /^[A-Z0-9_]{1,40}$/.test(error.code) ? error.code : 'PROCESS_ERROR' });
    }
  }
  const receipt = { projectId: 'demo-sgm-local-qa', runId, label,
    scope: 'read-only-native-process-failure-diagnostic-not-flow-verification', recordedAt: new Date().toISOString(),
    host: { totalMemoryBytes: totalmem(), freeMemoryBytes: freemem(), cpuCount: availableParallelism() }, records };
  writeFileSync(resolve(directory, `${label}-diagnostics.json`), JSON.stringify(receipt, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
  return receipt;
}

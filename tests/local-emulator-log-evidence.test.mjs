import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { retainLocalEmulatorLogs } from '../scripts/qa/local-emulator-log-evidence.mjs';

test('retained local emulator diagnostics redact credentials and never copy unrelated runtime files', () => {
  const root = mkdtempSync(resolve(tmpdir(), 'sgm-local-log-evidence-'));
  try {
    const output = resolve(root, 'evidence'); mkdirSync(output); const secret = 'ephemeral-fixture-password';
    writeFileSync(resolve(root, 'firestore-debug.log'), `Error: synthetic failure ${secret} Bearer example-token\n`);
    writeFileSync(resolve(root, 'database-debug.log'), 'ordinary diagnostic\n');
    writeFileSync(resolve(root, '.secret.local'), secret);
    assert.deepEqual(retainLocalEmulatorLogs(root, output, secret), ['emulator-firestore-debug.log.txt', 'emulator-database-debug.log.txt']);
    const retained = readFileSync(resolve(output, 'emulator-firestore-debug.log.txt'), 'utf8');
    assert(!retained.includes(secret)); assert(!retained.includes('example-token')); assert(retained.includes('synthetic failure'));
    assert.throws(() => retainLocalEmulatorLogs(root, output, secret), /EEXIST/);
    assert.throws(() => retainLocalEmulatorLogs('relative', output, secret));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

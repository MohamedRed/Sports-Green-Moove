import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { requiredTripCaptureNames, validatePrimaryCaptureDiagnostic } from './primary-capture-diagnostic-schema.mjs';

export function primaryCaptureDiagnosticArguments(value) {
  assert(value === undefined || value === 'false' || value === 'true', 'Invalid primary capture diagnostic mode');
  return value === 'true' ? ['-e', 'sgmPrimaryCaptureDiagnostics', 'true'] : [];
}

export function collectPrimaryCaptureDiagnostics({ adb, serial, directory, ordinaryPassed, run = spawnSync }) {
  assert(/^emulator-\d+$/.test(serial)); assert.equal(typeof ordinaryPassed, 'boolean');
  const output = resolve(directory, 'capture-timing'); mkdirSync(output);
  const receipt = { scope: 'capture-observation-collection-not-flow-or-root-cause-proof', ok: false,
    ordinaryPassed, copyStatus: null, copySignal: null, errorCode: null, traces: [], files: {} };
  try {
    const copied = run(adb, ['-s', serial, 'pull',
      '/sdcard/Android/data/be.sportgreenmoove.app/files/primary-capture-diagnostics', output],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 20_000 });
    receipt.copyStatus = copied.status; receipt.copySignal = copied.signal ?? null;
    if (copied.status !== 0 || copied.signal || copied.error) throw new Error('DIAGNOSTIC_COPY_FAILED');
    const folder = resolve(output, 'primary-capture-diagnostics'), entries = readdirSync(folder, { withFileTypes: true });
    assert(entries.length > 0 && entries.length <= 32);
    const names = new Set(); let complete = true;
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      assert(entry.isFile() && /^trip-change-[a-z0-9-]+-\d{1,20}\.json$/.test(entry.name));
      const bytes = readFileSync(resolve(folder, entry.name)); assert(bytes.length <= 64 * 1024);
      const trace = JSON.parse(bytes), checked = validatePrimaryCaptureDiagnostic(trace);
      assert(entry.name.startsWith(trace.captureName.replace(/\.png$/, '') + '-'));
      assert(!names.has(trace.captureName)); names.add(trace.captureName); complete &&= checked.complete;
      receipt.files['primary-capture-diagnostics/' + entry.name] = createHash('sha256').update(bytes).digest('hex');
      receipt.traces.push({ captureName: trace.captureName, primaryOutcome: trace.primaryOutcome,
        errorCategory: trace.errorCategory, elapsedMs: trace.elapsedMs, primaryElapsedMs: trace.primaryElapsedMs,
        primaryStartOffsetMs: trace.primaryStartOffsetMs, complete: checked.complete });
    }
    if (ordinaryPassed) assert.deepEqual([...names].sort(), requiredTripCaptureNames.slice().sort());
    receipt.ok = complete;
    if (!complete) receipt.errorCode = 'INCOMPLETE_CAPTURE_OBSERVATION';
  } catch (error) {
    receipt.errorCode = error?.message === 'DIAGNOSTIC_COPY_FAILED' ? error.message : 'DIAGNOSTIC_VALIDATION_FAILED';
  }
  writeFileSync(resolve(output, 'collection.json'), JSON.stringify(receipt, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
  return receipt;
}

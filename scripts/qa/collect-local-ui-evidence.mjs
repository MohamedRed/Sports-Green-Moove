import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { waitForDisposableDevice } from './disposable-device-cleanup.mjs';
import { collectNativeProcessFailure } from './native-process-failure-evidence.mjs';

const remote = '/sdcard/Android/data/be.sportgreenmoove.app.local/files/local-ui-evidence/.';
const phases = new Set(['confirmed-restart', 'response-loss', 'booking-response-loss', 'booking-ui-response-loss',
  'trip-change-parent-confirmation', 'trip-change-inputs', 'trip-change-schedule', 'trip-consent-restart', 'network-recovery', 'failure-cleanup']);
const text = (value) => Buffer.isBuffer(value) ? value.toString('utf8') : typeof value === 'string' ? value : '';

export class EvidenceCollectionError extends Error {
  constructor(phase, status, signal, receiptPath) {
    super(`Local evidence collection failed during ${phase}; status=${status}, signal=${signal}. See ${receiptPath}`);
    this.name = 'EvidenceCollectionError';
    this.status = status;
    this.signal = signal;
    this.receiptPath = receiptPath;
  }
}

export function collectLocalUiEvidence({ adb, serial, runId, evidenceDir, phase, password }, execute = execFileSync, spawn = spawnSync) {
  assert.equal(process.env.SGM_LOCAL_DISPOSABLE_EMULATOR, 'true');
  assert.match(serial, /^emulator-\d+$/);
  assert.match(runId, /^[a-f0-9]{32}$/);
  assert(isAbsolute(evidenceDir)); assert(phases.has(phase));
  assert(typeof password === 'string' && password.length >= 16, 'Explicit local credential redaction is required');
  const redact = (value) => text(value).replaceAll(password, '[REDACTED]');
  const receiptPath = resolve(evidenceDir, `adb-pull-${phase}.json`);
  assert(!existsSync(receiptPath), 'A named evidence copy cannot be repeated or overwrite its receipt');
  waitForDisposableDevice(adb, serial, execute);
  const version = redact(execute(adb, ['version'], { encoding: 'utf8', timeout: 30_000 }));
  let status = 0, signal = null, stdout = '', stderr = '', errorCode = null;
  try {
    // Restrict tracing to file sync, not authentication or packet payloads.
    const outcome = spawn(adb, ['-s', serial, 'pull', remote, evidenceDir], {
      env: { ...process.env, ADB_TRACE: 'sync' }, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 120_000, maxBuffer: 8 * 1024 * 1024,
    });
    status = Number.isInteger(outcome.status) ? outcome.status : null;
    signal = typeof outcome.signal === 'string' ? outcome.signal : null;
    errorCode = outcome.error ? redact(outcome.error.code ?? 'PROCESS_ERROR') : null;
    stdout = redact(outcome.stdout); stderr = redact(outcome.stderr);
  } catch (error) {
    status = Number.isInteger(error.status) ? error.status : null;
    signal = typeof error.signal === 'string' ? error.signal : null;
    errorCode = typeof error.code === 'string' ? redact(error.code) : 'PROCESS_ERROR';
    stdout = redact(error.stdout); stderr = redact(error.stderr);
  }
  const receipt = { projectId: 'demo-sgm-local-qa', runId, phase, recordedAt: new Date().toISOString(),
    scope: 'local-adb-file-sync-command-not-flow-verification', serial, version,
    status, signal, errorCode, stdout, stderr, completed: status === 0 && signal === null && errorCode === null };
  writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, { mode: 0o600, flag: 'wx' });
  if (!receipt.completed) {
    try {
      collectNativeProcessFailure({ adb, serial, runId, directory: evidenceDir,
        label: `evidence-copy-${phase}`, password }, execute);
    } catch { console.warn('Could not collect the failed evidence copy device diagnostics.'); }
    throw new EvidenceCollectionError(phase, status, signal, receiptPath);
  }
  return receipt;
}

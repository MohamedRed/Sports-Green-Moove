import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';

const remote = '/sdcard/Android/data/be.sportgreenmoove.app.local/files/local-ui-evidence';

export function summarizeSyncListing(output) {
  const lines = output.trim() ? output.trim().split('\n') : [];
  const entries = lines.map((line) => line.match(/^([a-fA-F0-9]{8})\s+([a-fA-F0-9]{8,16})\s+([a-fA-F0-9]{8,16})\s+(.+)$/));
  assert(entries.every(Boolean), 'Unrecognized file-sync listing');
  const names = entries.map((entry) => entry[4]);
  return listingSummary(names.filter((name) => name !== '.' && name !== '..'));
}

export function listingSummary(names) {
  return { entryCount: names.length, maxNameBytes: names.reduce((max, name) => Math.max(max, Buffer.byteLength(name)), 0),
    namesAreSimple: names.every((name) => /^[A-Za-z0-9_#.-]{1,255}$/.test(name)),
    pngCount: names.filter((name) => name.endsWith('.png')).length,
    jsonCount: names.filter((name) => name.endsWith('.json')).length };
}

export function summarizeDirectoryStat(output) {
  const match = output.trim().match(/^([0-7]{3,4}),(\d{1,10}),(\d{1,10}),(\d{1,16}),(-?\d{1,16})$/);
  assert(match, 'Unrecognized evidence directory metadata');
  assert(match.slice(2).every((value) => Number.isSafeInteger(Number(value))), 'Unsafe directory metadata');
  return { mode: match[1], uid: Number(match[2]), gid: Number(match[3]), bytes: Number(match[4]), modifiedAtSeconds: Number(match[5]) };
}

export function collectAdbSyncFailureDiagnostics({ adb, serial, runId, evidenceDir, phase, password }, execute = execFileSync) {
  assert.equal(process.env.SGM_LOCAL_DISPOSABLE_EMULATOR, 'true');
  assert.match(serial, /^emulator-\d+$/); assert.match(runId, /^[a-f0-9]{32}$/);
  assert(isAbsolute(evidenceDir)); assert.match(phase, /^[a-z-]{1,64}$/);
  assert(typeof password === 'string' && password.length >= 16);
  const path = resolve(evidenceDir, `adb-sync-${phase}-diagnostics.json`);
  assert(!existsSync(path), 'A diagnostic receipt cannot be repeated or overwritten');
  const redact = (output) => String(output).replaceAll(password, '[REDACTED]')
    .replace(/AIza[\w-]{20,}|Bearer\s+[\w.~+/-]+=*|eyJ[\w-]+\.[\w-]+\.[\w-]*/g, '[REDACTED]');
  const queries = [
    { id: 'directory-stat', args: ['shell', 'stat', '-c', '%a,%u,%g,%s,%Y', remote], select: summarizeDirectoryStat },
    { id: 'shell-listing', args: ['shell', 'ls', '-1A', remote], select: (text) => listingSummary(text.trim() ? text.trim().split('\n') : []) },
    { id: 'sync-listing', args: ['ls', remote], select: summarizeSyncListing },
    { id: 'storage-service-log', args: ['logcat', '-d', '-b', 'main', '-b', 'system', '-t', '300', '-v', 'threadtime',
      'adbd:I', 'vold:W', 'FuseDaemon:W', 'ExternalStorageService:W', '*:S'], select: redact },
  ];
  const observations = [];
  for (const { id, args, select } of queries) {
    try {
      const output = execute(adb, ['-s', serial, ...args], {
        encoding: 'utf8', timeout: 5_000, maxBuffer: 256 * 1024, stdio: ['ignore', 'pipe', 'pipe'],
      });
      observations.push({ id, collected: true, value: select(output) });
    } catch (failure) {
      observations.push({ id, collected: false,
        status: Number.isInteger(failure.status) ? failure.status : null,
        errorCode: /^[A-Z0-9_]{1,40}$/.test(failure.code) ? failure.code : 'DIAGNOSTIC_ERROR' });
    }
  }
  const result = { projectId: 'demo-sgm-local-qa', runId, phase, recordedAt: new Date().toISOString(),
    scope: 'read-only-sync-failure-diagnostics-not-copy-or-flow-verification', observations };
  writeFileSync(path, JSON.stringify(result, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
  return result;
}

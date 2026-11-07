import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, dirname, isAbsolute } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const temp = mkdtempSync(resolve(tmpdir(), 'sgm-booking-recovery-'));
const sources = ['Models.swift', 'ReviewTripContext.swift', 'BookingIntentSnapshot.swift', 'PendingBookingStore.swift', 'BookingRequestCoordinator.swift']
  .map((name) => `ios/Sources/SportsGreenMooveApp/${name}`);
try {
  const output = process.env.SGM_SWIFT_BOOKING_RECOVERY_OUTPUT || resolve(temp, 'results.json');
  assert(isAbsolute(output) && !existsSync(output), 'Use a fresh absolute recovery evidence output');
  const binary = resolve(temp, 'recovery');
  execFileSync('swiftc', ['-swift-version', '6', ...sources, 'scripts/qa/check-booking-recovery.swift', '-o', binary],
    { cwd: root, stdio: 'inherit', timeout: 120_000 });
  const reports = [];
  for (const mode of ['checks', 'prepare', 'recover']) {
    const path = resolve(temp, `${mode}.json`);
    execFileSync(binary, [mode, resolve(temp, 'fixtures'), path], { cwd: root, stdio: 'inherit', timeout: 30_000 });
    reports.push(JSON.parse(readFileSync(path)));
  }
  assert(reports.every((run) => run.passed));
  const result = { ...reports[0], testedAt: new Date().toISOString(), cases: reports.flatMap((run) => run.cases),
    separateProcessRecovery: true, swiftLanguageVersion: 6,
    sourceSha256: Object.fromEntries(sources.map((path) => [path, createHash('sha256').update(readFileSync(resolve(root, path))).digest('hex')])) };
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`);
} finally { rmSync(temp, { recursive: true, force: true }); }

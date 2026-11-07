import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, isAbsolute, dirname } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const temp = mkdtempSync(resolve(tmpdir(), 'sgm-booking-wire-'));
try {
  const output = process.env.SGM_SWIFT_BOOKING_OUTPUT || resolve(temp, 'result.json');
  assert(isAbsolute(output));
  assert(!existsSync(output), 'Use a fresh wire evidence output');
  mkdirSync(dirname(output), { recursive: true });
  const binary = resolve(temp, 'booking-wire');
  execFileSync('swiftc', ['-swift-version', '6', 'ios/Sources/SportsGreenMooveApp/Models.swift',
    'ios/Sources/SportsGreenMooveApp/ReviewTripContext.swift',
    'ios/Sources/SportsGreenMooveApp/BookingIntentSnapshot.swift', 'scripts/qa/check-booking-intent.swift', '-o', binary],
  { cwd: root, stdio: 'inherit', timeout: 120_000 });
  execFileSync(binary, [output], { cwd: root, stdio: 'inherit', timeout: 30_000 });
} finally { rmSync(temp, { recursive: true, force: true }); }

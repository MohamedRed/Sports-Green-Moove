import assert from 'node:assert/strict';
import test from 'node:test';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { validateNotificationReadPhone } from '../scripts/qa/notification-read-phone-evidence.mjs';

const record = {source: 'docs/release/evidence/notification-read-phone-2026-10-23/summary.json', checkedAt: '2026-10-23',
  checksums: 'docs/release/evidence/notification-read-phone-2026-10-23/artifact-sha256.json'};
test('phone read and sequential account isolation bind four original captures to independently unchanged records', () => {
  const report = validateNotificationReadPhone(process.cwd(), record);
  assert.equal(report.actualPhoneReadPassed, true); assert.equal(report.processDeathAccepted, false);
});
for (const [file, key] of [
  ...['processDeathAccepted', 'nativeProcessIdsMeasured', 'pushDeliveryAccepted', 'productionWrites', 'releaseComplete', 'iosAccepted', 'videoAccepted']
    .map(key => ['summary.json', key]),
  ...['finalPhoneSignOutVerified', 'appUninstallVerified', 'launcherAbsenceVerified'].map(key => ['cleanup.json', key]),
]) test('phone evidence cannot promote ' + key, t => {
  const root = mkdtempSync(resolve(tmpdir(), 'sgm-notice-phone-proof-')); t.after(() => rmSync(root, {recursive: true, force: true}));
  const base = dirname(record.source); cpSync(base, resolve(root, base), {recursive: true});
  const path = resolve(root, base, file), row = JSON.parse(readFileSync(path)); row[key] = true;
  writeFileSync(path, JSON.stringify(row)); assert.throws(() => validateNotificationReadPhone(root, record));
});

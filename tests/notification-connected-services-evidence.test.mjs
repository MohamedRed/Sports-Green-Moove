import assert from 'node:assert/strict';
import test from 'node:test';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { validateNotificationConnectedServices } from '../scripts/qa/notification-connected-services-evidence.mjs';

const record = {source: 'docs/release/evidence/notification-connected-services-2026-10-23/summary.json', checkedAt: '2026-10-23',
  checksums: 'docs/release/evidence/notification-connected-services-2026-10-23/artifact-sha256.json'};
test('four real authenticated service checks protect 167 records without promoting native or physical evidence', () => {
  const report = validateNotificationConnectedServices(process.cwd(), record);
  assert.equal(report.serviceChecksPassed, 4); assert.equal(report.protectedRecordCount, 167);
  assert.equal(report.connectedNativeUiAccepted, false); assert.equal(report.previousNativeWorkflowPassed, false);
});
for (const key of ['connectedNativeUiAccepted', 'previousNativeWorkflowPassed', 'downloadFailureRootCauseConfirmed',
  'physicalPhoneAccepted', 'pushDeliveryAccepted', 'productionWrites', 'releaseComplete']) {
  test('service evidence cannot promote ' + key, t => {
    const root = mkdtempSync(resolve(tmpdir(), 'sgm-notice-service-proof-'));
    t.after(() => rmSync(root, {recursive: true, force: true}));
    const base = dirname(record.source); cpSync(base, resolve(root, base), {recursive: true});
    const file = resolve(root, record.source), report = JSON.parse(readFileSync(file)); report[key] = true;
    writeFileSync(file, JSON.stringify(report));
    assert.throws(() => validateNotificationConnectedServices(root, record));
  });
}

import assert from 'node:assert/strict';
import test from 'node:test';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { validateNotificationNativeRecovery } from '../scripts/qa/notification-native-recovery-evidence.mjs';

const record = {source: 'docs/release/evidence/notification-native-recovery-2026-10-23/summary.json', checkedAt: '2026-10-23',
  checksums: 'docs/release/evidence/notification-native-recovery-2026-10-23/artifact-sha256.json'};
test('the completed connected notification stage preserves 176 records across process death without accepting the later failed matrix', () => {
  const report = validateNotificationNativeRecovery(process.cwd(), record);
  assert.equal(report.notificationStageAccepted, true); assert.equal(report.fullReplayAccepted, false);
});
for (const key of ['fullReplayAccepted', 'workflowPassed', 'driverApprovalRegressionCorrected', 'exactPostFailureApprovalStateRetained',
  'physicalPhoneAccepted', 'pushDeliveryAccepted', 'newMediaPublished', 'productionWrites', 'releaseComplete'])
  test('completed notification stage cannot promote ' + key, t => {
    const root = mkdtempSync(resolve(tmpdir(), 'sgm-notice-recovered-proof-')); t.after(() => rmSync(root, {recursive: true, force: true}));
    const base = dirname(record.source); cpSync(base, resolve(root, base), {recursive: true});
    const path = resolve(root, record.source), row = JSON.parse(readFileSync(path)); row[key] = true;
    writeFileSync(path, JSON.stringify(row)); assert.throws(() => validateNotificationNativeRecovery(root, record));
  });

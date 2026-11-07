import assert from 'node:assert/strict';
import test from 'node:test';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { content } from '../partner-portal/content.mjs';
import { validateNotificationNativeRecheck } from '../scripts/qa/notification-native-recheck-evidence.mjs';

const record = content.flows.find(flow => flow.id === 'notification-settings').notificationNativeRecheck;
test('seven exact notification cases were executed in the failed replay, not only compiled', () => {
  const report = validateNotificationNativeRecheck(process.cwd(), record);
  assert.equal(report.nativeCasesPassed, 7); assert.equal(report.fullCiPassed, false);
  assert.equal(report.pushDeliveryAccepted, false); assert.equal(report.hostExitVerified, false);
});
for (const key of ['fullCiPassed', 'pushDeliveryAccepted', 'hostExitVerified', 'newPhysicalPhoneTrial', 'releaseComplete'])
  test('executed component proof cannot promote ' + key, t => {
    const root = mkdtempSync(resolve(tmpdir(), 'sgm-notification-native-'));
    t.after(() => rmSync(root, {recursive: true, force: true}));
    const base = dirname(record.source); cpSync(base, resolve(root, base), {recursive: true});
    const file = resolve(root, record.source), data = JSON.parse(readFileSync(file)); data[key] = true;
    writeFileSync(file, JSON.stringify(data));
    assert.throws(() => validateNotificationNativeRecheck(root, record));
  });

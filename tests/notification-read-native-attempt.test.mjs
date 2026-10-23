import assert from 'node:assert/strict';
import test from 'node:test';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { validateNotificationNativeAttempt } from '../scripts/qa/notification-native-attempt-evidence.mjs';

const record = {source: 'docs/release/evidence/notification-native-attempt-2026-10-23/summary.json', checkedAt: '2026-10-23',
  checksums: 'docs/release/evidence/notification-native-attempt-2026-10-23/artifact-sha256.json'};
test('two executed restart stages and four passing components do not accept the failed primary copy or full replay', () => {
  const report = validateNotificationNativeAttempt(process.cwd(), record);
  assert.equal(report.notificationNativeStagesExecuted, 2); assert.equal(report.fullReplayAccepted, false);
});
for (const key of ['primaryCollectionAccepted', 'connectedStageAccepted', 'fullReplayAccepted', 'workflowPassed', 'newMediaAccepted', 'releaseComplete'])
  test('native attempt cannot promote ' + key, t => {
    const root = mkdtempSync(resolve(tmpdir(), 'sgm-notice-native-proof-')); t.after(() => rmSync(root, {recursive: true, force: true}));
    const base = dirname(record.source); cpSync(base, resolve(root, base), {recursive: true});
    const path = resolve(root, record.source), row = JSON.parse(readFileSync(path)); row[key] = true;
    writeFileSync(path, JSON.stringify(row)); assert.throws(() => validateNotificationNativeAttempt(root, record));
  });

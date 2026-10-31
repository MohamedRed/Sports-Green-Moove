import assert from 'node:assert/strict';
import test from 'node:test';
import { content } from '../partner-portal/content.mjs';
import { validateAdminClientLifecycle } from '../scripts/qa/admin-client-lifecycle-evidence.mjs';

test('retained shutdown regression binds actual clients, natural exits and the incomplete full replay', () => {
  const report = validateAdminClientLifecycle(process.cwd(), content.adminClientLifecycleRecheck);
  assert.equal(report.cases.length, 3); assert.equal(report.nativeReplayAccepted, false);
  const blocker = content.blockers.find(row => row.id === 'notification-native-replay');
  assert.equal(blocker, undefined);
  assert(content.updates.some(row => row.source === content.adminClientLifecycleRecheck.source.replace('results.json', 'README.md')));
});
test('shutdown regression cannot be displayed as a different verification date', () => {
  assert.throws(() => validateAdminClientLifecycle(process.cwd(), {
    ...content.adminClientLifecycleRecheck, checkedAt: '2026-10-23',
  }));
});

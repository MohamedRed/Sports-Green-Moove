import assert from 'node:assert/strict';
import test from 'node:test';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { validateNativePaymentHeadRecheck } from '../scripts/qa/native-payment-head-evidence.mjs';
import { validateCurrentNativeBlocker } from '../scripts/qa/flow-recheck-evidence.mjs';
import { content } from '../partner-portal/content.mjs';

const record = content.nativePaymentHeadRecheck;
test('passing driver replay remains separate from two later native failures', () => {
  const summary = validateNativePaymentHeadRecheck(process.cwd(), record);
  assert.equal(summary.identityScopedApprovalExecuted, true); assert.equal(summary.ordinaryPassed, 159);
  assert.equal(summary.focusedCasesFailed, 1); assert.equal(summary.fullReplayAccepted, false);
  validateCurrentNativeBlocker(process.cwd(), content);
});
test('the current blocker cannot point back to the superseded approval failure', () => {
  const changed = structuredClone(content);
  changed.blockers.push({ id: 'notification-native-replay',
    source: content.notificationNativeRecovery.source.replace('summary.json', 'README.md') });
  assert.throws(() => validateCurrentNativeBlocker(process.cwd(), changed));
});
for (const [file, key, value] of [
  ...['primaryCopyAccepted', 'fullReplayAccepted', 'workflowPassed', 'startupCaseAccepted',
    'rootCauseConfirmed', 'newMediaPublished', 'physicalTrackingAccepted', 'productionWrites', 'releaseComplete']
    .map(key => ['summary.json', key, true]),
  ['primary-copy.json', 'completed', true], ['startup-host.json', 'finalState', 'zombie'],
  ['main-restoration.json', 'verified', false]]) {
  test('native partial evidence rejects unsupported ' + file + ':' + key, t => {
    const root = mkdtempSync(resolve(tmpdir(), 'sgm-payment-head-proof-'));
    t.after(() => rmSync(root, {recursive: true, force: true}));
    const base = dirname(record.source); cpSync(base, resolve(root, base), {recursive: true});
    const path = resolve(root, base, file), row = JSON.parse(readFileSync(path)); row[key] = value;
    writeFileSync(path, JSON.stringify(row)); assert.throws(() => validateNativePaymentHeadRecheck(root, record));
  });
}

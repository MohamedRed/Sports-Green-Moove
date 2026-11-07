import assert from 'node:assert/strict';
import test from 'node:test';
import { content } from '../partner-portal/content.mjs';
import { validateNotificationReadLocal } from '../scripts/qa/notification-read-local-evidence.mjs';
import { validateNativeReplay0f91172f } from '../scripts/qa/native-replay-0f91172f-evidence.mjs';

test('local notification acknowledgements are proven without promoting phone or push delivery', () => {
  const record = content.flows.find(flow => flow.id === 'notification-settings').notificationReadLocal;
  const result = validateNotificationReadLocal(process.cwd(), record);
  assert.equal(result.serviceTestsPassed, 19); assert.equal(result.nativeStateTestsPassed, 10);
  assert.equal(result.nativeUiExecuted, false); assert.equal(result.pushDeliveryAccepted, false);
});
test('the later full replay completed copies and teardown without explaining the older failure', () => {
  const result = validateNativeReplay0f91172f(process.cwd(), content.completedNativeReplayRecheck);
  assert.equal(result.fullCiPassed, true); assert.equal(result.earlierTransportRootCauseConfirmed, false);
  assert.equal(result.releaseComplete, false);
});
test('missing local evidence or a substituted older native record is not accepted', () => {
  assert.throws(() => validateNotificationReadLocal(process.cwd(), {source: content.latestNativeCopyRecheck.source}));
  assert.throws(() => validateNativeReplay0f91172f(process.cwd(), content.latestNativeCopyRecheck));
});

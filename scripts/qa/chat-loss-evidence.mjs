import assert from 'node:assert/strict';
import { faultMessage } from './native-chat-loss-proxy.mjs';

export function assertChatLossReceipt(ui, proxy, runId, sourceId) {
  assert.match(runId, /^[a-f0-9]{32}$/); assert(sourceId);
  for (const receipt of [ui, proxy]) {
    assert.equal(receipt.projectId, 'demo-sgm-local-qa'); assert.equal(receipt.runId, runId);
    assert.equal(receipt.sourceId, sourceId); assert.equal(receipt.scope, 'native-sdk-controlled-post-commit-reply-loss');
  }
  for (const key of ['completed', 'initialReplyLost', 'rejectedRetryRetained', 'finalSendConfirmed',
    'networkRestored', 'firestoreAcknowledgementDeferred']) assert.equal(ui[key], true, `Missing app observation: ${key}`);
  assert(!proxy.failed); assert.equal(proxy.phase, 'recover');
  assert.deepEqual(proxy.transitions, [{ from: 'loss', to: 'reject' }, { from: 'reject', to: 'recover' }]);
  assert(Array.isArray(proxy.attempts) && proxy.attempts.length >= 3);
  const phases = ['loss', 'reject', 'recover'];
  for (const phase of phases) assert(proxy.attempts.some((attempt) => attempt.phase === phase));
  const original = proxy.attempts[0].commit;
  assert.equal(proxy.attempts[0].phase, 'loss'); assert.equal(proxy.attempts.at(-1).phase, 'recover');
  assert.equal(original.messageCount, 1); assert.equal(original.notificationCount, 1);
  assert.equal(original.recipientUserId, 'sgm-qa-driver');
  assert(original.messageId && original.notificationId);
  assert.match(original.clientMessageId, /^[a-f0-9-]{36}$/);
  assert(Number.isSafeInteger(original.createdAtMillis) && original.createdAtMillis > 0);
  let previous = 0;
  for (const attempt of proxy.attempts) {
    const phase = phases.indexOf(attempt.phase);
    assert(phase >= previous && phase >= 0, 'Attempts must follow the observed phase order'); previous = phase;
    assert.equal(attempt.body, faultMessage); assert.equal(attempt.clientMessageId, original.clientMessageId);
    if (attempt.phase === 'reject') {
      assert.equal(attempt.injectedRejection, true); assert.equal(attempt.downstreamStatus, 429);
      assert.equal(attempt.acknowledgementDropped, false);
      assert.equal(attempt.commit, undefined); assert.equal(attempt.upstreamStatus, undefined);
    } else {
      assert.deepEqual(attempt.commit, original, 'The saved record and notification must remain unchanged');
      assert.equal(attempt.upstreamStatus, 200); assert.equal(attempt.injectedRejection, false);
      assert.equal(attempt.acknowledgementDropped, attempt.phase === 'loss');
      assert.equal(attempt.downstreamStatus, attempt.phase === 'loss' ? undefined : 200);
    }
  }
  return original;
}

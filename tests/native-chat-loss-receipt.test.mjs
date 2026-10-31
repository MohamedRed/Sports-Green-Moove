import assert from 'node:assert/strict';
import test from 'node:test';
import { assertChatLossReceipt } from '../scripts/qa/chat-loss-evidence.mjs';
import { faultMessage } from '../scripts/qa/native-chat-loss-proxy.mjs';

const runId = 'a'.repeat(32), sourceId = 'unit-fixture-only';
function fixture() {
  const common = { projectId: 'demo-sgm-local-qa', runId, sourceId, scope: 'native-sdk-controlled-post-commit-reply-loss' };
  const commit = { messageId: 'unit-message', notificationId: 'unit-note', messageCount: 1, notificationCount: 1,
    recipientUserId: 'sgm-qa-driver', clientMessageId: '11111111-1111-1111-1111-111111111111', createdAtMillis: 1_700_000_000_000 };
  const base = { clientMessageId: commit.clientMessageId, body: faultMessage, acknowledgementDropped: false, injectedRejection: false };
  return { ui: { ...common, completed: true, initialReplyLost: true, rejectedRetryRetained: true,
    finalSendConfirmed: true, networkRestored: true, firestoreAcknowledgementDeferred: true },
  proxy: { ...common, phase: 'recover', transitions: [{ from: 'loss', to: 'reject' }, { from: 'reject', to: 'recover' }], attempts: [
    { ...base, phase: 'loss', upstreamStatus: 200, acknowledgementDropped: true, commit },
    { ...base, phase: 'reject', downstreamStatus: 429, injectedRejection: true },
    { ...base, phase: 'recover', upstreamStatus: 200, downstreamStatus: 200, commit: structuredClone(commit) },
  ] } };
}
test('complete same-run controlled-fault receipts allow repeated transport attempts but require explicit recovery', () => {
  const { ui, proxy } = fixture();
  assert.equal(assertChatLossReceipt(ui, proxy, runId, sourceId).messageId, 'unit-message');
  proxy.attempts.splice(1, 0, structuredClone(proxy.attempts[0]));
  assert.doesNotThrow(() => assertChatLossReceipt(ui, proxy, runId, sourceId));
});
test('missing observations, stale runs, changed saved identity, fake rejection and skipped or failed phases fail closed', () => {
  const corruptions = [
    ({ ui }) => { ui.completed = false; }, ({ ui }) => { ui.initialReplyLost = 'true'; },
    ({ ui }) => { ui.firestoreAcknowledgementDeferred = false; }, ({ ui }) => { ui.networkRestored = false; },
    ({ ui }) => { ui.sourceId = 'other'; }, ({ proxy }) => { proxy.runId = 'b'.repeat(32); },
    ({ proxy }) => { proxy.failed = true; }, ({ proxy }) => { proxy.phase = 'loss'; },
    ({ proxy }) => { proxy.transitions.reverse(); }, ({ proxy }) => { proxy.attempts.splice(1, 1); },
    ({ proxy }) => { proxy.attempts[0].acknowledgementDropped = false; },
    ({ proxy }) => { proxy.attempts[0].downstreamStatus = 200; },
    ({ proxy }) => { proxy.attempts[1].upstreamStatus = 200; },
    ({ proxy }) => { proxy.attempts[1].injectedRejection = false; },
    ({ proxy }) => { proxy.attempts[2].clientMessageId = '22222222-2222-2222-2222-222222222222'; },
    ({ proxy }) => { proxy.attempts[2].commit.createdAtMillis++; },
    ({ proxy }) => { proxy.attempts[2].commit.notificationCount = 2; },
    ({ proxy }) => { proxy.attempts[2].downstreamStatus = 502; },
    ({ proxy }) => { proxy.attempts.push(structuredClone(proxy.attempts[0])); },
  ];
  for (const corrupt of corruptions) {
    const value = fixture(); corrupt(value);
    assert.throws(() => assertChatLossReceipt(value.ui, value.proxy, runId, sourceId));
  }
});

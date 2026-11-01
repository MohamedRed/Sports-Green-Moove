import assert from 'node:assert/strict';
import {verifyChatNetworkPhoneCheckpoint} from './chat-network-phone-checkpoints.mjs';

export const chatReceiptLossPhases = ['parent-ready', 'conversation-open', 'receipt-lost', 'recovery-ready',
  'parent-confirmed', 'parent-reopened', 'driver-visible', 'signed-out'];
const rows = (state, name) => state.documents[name] ?? [];
const owned = (row, fixture) => row.data.sourceType === 'booking' && row.data.sourceId === fixture.bookingId;
const millis = value => value?.toMillis?.() ?? value?._seconds * 1000 + value?._nanoseconds / 1e6;

export function normalizeChatReceiptProfile(input, baseline, fixture) {
  // Both fixture accounts may sign in; only their profile-refresh timestamp may advance.
  return {...input, documents: {...input.documents, users: rows(input, 'users').map(row => {
    if (row.id !== fixture.driverUid) return row;
    const before = rows(baseline, 'users').find(item => item.id === row.id)?.data.updatedAt;
    assert(Number.isFinite(millis(before)) && millis(row.data.updatedAt) >= millis(before));
    const {updatedAt, ...data} = row.data; return {id: row.id, data};
  })}};
}

export function verifyChatReceiptLossCheckpoint(phase, baseline, state, fixture, receipt, originalMessage) {
  const index = chatReceiptLossPhases.indexOf(phase); assert(index >= 0); assert.equal(receipt.failed, false);
  verifyChatNetworkPhoneCheckpoint(index < 2 ? 'ready' : 'parent-sent',
    normalizeChatReceiptProfile(baseline, baseline, fixture), normalizeChatReceiptProfile(state, baseline, fixture), fixture);
  if (index < 2) {assert.equal(receipt.phase, 'armed'); assert.equal(receipt.attempts.length, 0);}
  else {
    const first = receipt.attempts[0]; assert(first);
    assert.equal(first.phase, 'armed'); assert.equal(first.upstreamAcknowledged, true);
    assert.equal(first.commitIndependentlyVerified, true); assert.equal(first.responseReleased, false);
    assert.equal(first.upstreamStatus, 200);
    assert.equal(receipt.phase, index <= 3 ? 'lost' : 'recover');
    const message = rows(state, 'messages').find(row => owned(row, fixture));
    assert(originalMessage); assert.equal(first.messageId, message.id);
    assert.equal(first.clientMessageId, message.data.clientMessageId);
    const {readByUserIds, ...data} = message.data, {readByUserIds: originalRead, ...original} = originalMessage.data;
    assert.deepEqual({id: message.id, data}, {id: originalMessage.id, data: original}, 'Preserve the original committed record and timestamp');
    assert(Number.isFinite(millis(data.createdAt)), 'A server commit timestamp must be present');
    assert.deepEqual([...readByUserIds].sort(), index >= 6 ? [fixture.parentUid, fixture.driverUid].sort() : [fixture.parentUid]);
    const note = rows(state, 'notifications').find(row => owned(row, fixture));
    assert.equal(note.data.read, index >= 6); assert.deepEqual(note.data.createdAt, data.createdAt);
    for (const attempt of receipt.attempts) {
      assert.equal(attempt.clientMessageId, first.clientMessageId);
      if (attempt.blockedBeforeForwarding) {
        assert.equal(attempt.phase, 'lost'); assert.equal(attempt.upstreamAcknowledged, false); assert.equal(attempt.responseReleased, false);
      } else {
        assert.equal(attempt.messageId, first.messageId); assert.equal(attempt.commitIndependentlyVerified, true);
        assert.equal(attempt.upstreamAcknowledged, true); assert.equal(attempt.upstreamStatus, 200);
        assert.equal(attempt.responseReleased, attempt.phase === 'recover');
      }
    }
  }
  return {phase, status: 'passed', messageCount: index < 2 ? 0 : 1, notificationCount: index < 2 ? 0 : 1,
    originalCommittedIdentityPreserved: index >= 2, foreignRecordsAndClaimsPreserved: true,
    phoneUiProvenByObserver: false, physicalRadioLossProvenByObserver: false};
}

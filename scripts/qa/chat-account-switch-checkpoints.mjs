import {verifyChatNetworkPhoneCheckpoint} from './chat-network-phone-checkpoints.mjs';
import assert from 'node:assert/strict';

export const chatAccountSwitchPhases = ['ready', 'conversation-open', 'offline-failed', 'online-before-switch',
  'parent-signed-out', 'driver-home', 'driver-conversation-empty', 'driver-signed-out',
  'parent-pending-restored', 'parent-sent', 'signed-out'];

function withoutDriverInitializationTimestamp(state, driverUid) {
  return {...state, documents: {...state.documents, users: (state.documents.users ?? []).map(row => {
    if (row.id !== driverUid) return row;
    const {updatedAt, ...data} = row.data;
    return {...row, data};
  })}};
}

export function verifyChatAccountSwitchCheckpoint(phase, baseline, state, fixture) {
  const index = chatAccountSwitchPhases.indexOf(phase); assert(index >= 0);
  const check = verifyChatNetworkPhoneCheckpoint(index < 9 ? 'ready' : 'parent-sent',
    withoutDriverInitializationTimestamp(baseline, fixture.driverUid),
    withoutDriverInitializationTimestamp(state, fixture.driverUid), fixture);
  return {...check, phase, driverInitializationTimestampExcluded: true,
    accountUiIsolationProvenByObserver: false, originalPendingIdentityProvenByObserver: false};
}

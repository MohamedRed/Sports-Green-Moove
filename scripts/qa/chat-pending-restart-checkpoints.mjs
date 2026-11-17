import assert from 'node:assert/strict';
import {verifyChatNetworkPhoneCheckpoint} from './chat-network-phone-checkpoints.mjs';

export const chatPendingRestartPhases=['ready','conversation-open','offline-failed','process-stopped',
  'process-reopened','online-before-retry','pending-restored','parent-sent','signed-out'];
export function verifyChatPendingRestartCheckpoint(phase,baseline,state,fixture) {
  const index=chatPendingRestartPhases.indexOf(phase);assert(index>=0,'Unknown pending restart phase');
  const sent=index>=chatPendingRestartPhases.indexOf('parent-sent');
  const check=verifyChatNetworkPhoneCheckpoint(sent?'parent-sent':'ready',baseline,state,fixture);
  return {...check,phase,automaticSendObserved:false,processDeathProvenByObserver:false,
    originalPendingIdentityProvenByObserver:false,postCommitResponseLossExercised:false};
}

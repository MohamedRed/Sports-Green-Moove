import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {chatPendingRestartPhases,verifyChatPendingRestartCheckpoint} from '../scripts/qa/chat-pending-restart-checkpoints.mjs';
const path='../docs/release/evidence/chat-network-phone-2026-10-31/records/';
const json=file=>JSON.parse(readFileSync(new URL(path+file+'.json',import.meta.url)));
const fixture=json('fixture').fixture,baseline=json('baseline'),empty=json('ready').state,sent=json('parent-sent').state;
for(const phase of chatPendingRestartPhases) test('pending-restart record contract: '+phase,()=>{
  const state=['parent-sent','signed-out'].includes(phase)?sent:empty;
  const check=verifyChatPendingRestartCheckpoint(phase,baseline,state,fixture);
  assert.equal(check.messageCount,state===sent?1:0);assert.equal(check.phase,phase);
  for(const field of ['phoneUiProvenByObserver','processDeathProvenByObserver','originalPendingIdentityProvenByObserver',
    'physicalRadioLossProvenByObserver','postCommitResponseLossExercised'])assert.equal(check[field],false);
});
for(const phase of chatPendingRestartPhases.slice(0,7)) test('automatic sends are rejected before explicit retry: '+phase,()=>{
  assert.throws(()=>verifyChatPendingRestartCheckpoint(phase,baseline,sent,fixture),/Exactly one message/);
});
test('an extra message or notification, foreign records, claims and live tracking remain protected',()=>{
  for(const change of [state=>state.documents.messages.push(state.documents.messages[0]),
    state=>state.documents.notifications.push(state.documents.notifications.find(row=>row.data.type==='chatMessage')),
    state=>{state.claims=[];},state=>{state.liveTrips={changed:true};},
    state=>{state.documents.bookings[0].data.status='cancelled';}]) {
    const changed=structuredClone(sent);change(changed);
    assert.throws(()=>verifyChatPendingRestartCheckpoint('parent-sent',baseline,changed,fixture));
  }
});
test('unknown phases are refused and the observer never invokes a chat send',()=>{
  assert.throws(()=>verifyChatPendingRestartCheckpoint('invented',baseline,empty,fixture));
  const source=readFileSync(new URL('../scripts/qa/manual-chat-pending-restart-phone.mjs',import.meta.url),'utf8');
  assert.doesNotMatch(source,/call\(['"]sendChatMessage|executeShellCommand|force-stop|\.kill\(/);
  assert(source.includes('assert.equal(phase,chatPendingRestartPhases[checkpoints.length])'));
});

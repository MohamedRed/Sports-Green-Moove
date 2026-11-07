import assert from 'node:assert/strict';

export const notificationRetryProtocol=[['ready','check'],['publish','action'],['arrived','check'],['read','check'],
  ['corrupt','action'],['error','check'],['retry-failed','check'],['restore','action'],['recovered','check'],
  ['publish-next','action'],['next-arrived','check']];
export const notificationRetryPhases=notificationRetryProtocol.filter(([,kind])=>kind==='check').map(([id])=>id);
export const notificationRetryBody='Message pour la reprise des alertes QA';
export const notificationRetryLaterBody='Message suivant après la reprise QA';
export const notificationRetryCorruptBody='Métadonnée invalide pour cet essai isolé';

export function notificationApiCounts(log) {
  const counts={getInbox:0,listChatConversations:0,getNotificationInbox:0};
  for(const match of log.matchAll(/Beginning execution of "us-central1-(getInbox|listChatConversations|getNotificationInbox)"/g))counts[match[1]]++;
  return counts;
}
export function verifyNotificationRetryCheckpoint(phase,before,state,identity,prior) {
  const index=notificationRetryPhases.indexOf(phase);assert(index>=0);
  assert.deepEqual(state.records.claims,before.claims);assert.deepEqual(state.records.liveTrips,before.liveTrips);
  assert.deepEqual(state.disabled,before.disabled);
  let protectedRecords=0;
  for(const [collection,rows]of Object.entries(before.documents))for(const row of rows){
    assert.deepEqual(state.records.documents[collection]?.find(item=>item.id===row.id),row,collection+'/'+row.id);protectedRecords++;
  }
  const messages=index===0?0:phase==='next-arrived'?2:1,bad=['error','retry-failed'].includes(phase),read=index>=2;
  assert.equal(state.messages.length,messages);assert.equal(state.operations.length,messages);
  assert.equal(state.alerts.length,messages*2);assert.equal(state.envelopes.length,messages);assert.deepEqual(state.readReceipts,[]);
  assert.deepEqual(state.messages.map(row=>row.id),messages?[identity.firstMessageId,...(messages===2?[identity.nextMessageId]:[])]:[]);
  assert.deepEqual(state.operations.map(row=>row.id).sort(),state.messages.map(row=>row.id).sort());
  const allowed={teamConversations:messages?[identity.teamInstanceId]:[],teamMessageOperations:state.messages.map(row=>row.id),
    teamChatNotifications:state.alerts.map(row=>row.id),teamPushOutbox:state.messages.map(row=>row.id)};
  for(const [collection,rows]of Object.entries(state.records.documents))for(const row of rows)
    if(!before.documents[collection]?.some(item=>item.id===row.id))assert(allowed[collection]?.includes(row.id),'Unexpected new record: '+collection+'/'+row.id);
  for(const row of state.messages){
    assert.equal(row.senderUserId,identity.driverUid);
    assert.equal(row.body,row.id===identity.firstMessageId?notificationRetryBody:notificationRetryLaterBody);
    assert.deepEqual(state.alerts.filter(note=>note.messageId===row.id).map(note=>note.userId).sort(),[identity.parentUid,identity.otherUid].sort());
  }
  for(const note of state.alerts){
    assert.equal(note.title,'Nouveau message d’équipe');
    assert.equal(note.body,bad&&note.id===identity.firstNoticeId?notificationRetryCorruptBody:'Un nouveau message est disponible dans votre équipe.');
    if(note.id===identity.firstNoticeId){assert.equal(note.read,read);if(read)assert.deepEqual(note.readAt,identity.firstReadAt);}
    else assert.equal(note.read,false);
  }
  for(const item of state.envelopes){assert.equal(item.status,'pending');assert(state.messages.some(row=>row.id===item.messageId));
    assert.deepEqual(item.recipientUserIds,[identity.parentUid,identity.otherUid].sort());}
  if(bad)assert.deepEqual(state.parentInbox,{denied:'FAILED_PRECONDITION'});
  else{
    assert.equal(state.parentInbox.userId,identity.parentUid);
    assert.deepEqual(state.parentInbox.notifications.filter(row=>!row.id.startsWith('teamChat_')),before.parentNotifications);
    assert.deepEqual(state.parentInbox.notifications.filter(row=>row.id.startsWith('teamChat_')).map(row=>row.id),
      messages===2?[identity.nextNoticeId,identity.firstNoticeId]:messages?[identity.firstNoticeId]:[]);
  }
  assert.equal(state.otherInbox.userId,identity.otherUid);
  assert.deepEqual(state.otherInbox.notifications.filter(row=>!row.id.startsWith('teamChat_')),before.otherNotifications);
  assert.equal(state.otherInbox.notifications.filter(row=>row.id.startsWith('teamChat_')).length,messages);
  if(index>=4){
    assert(prior.error);for(const name of ['getInbox','listChatConversations'])assert.equal(state.apiCalls[name],prior.error.apiCalls[name],name);
  }
  if(phase==='retry-failed')assert.equal(state.apiCalls.getNotificationInbox-prior.error.apiCalls.getNotificationInbox,3);
  return{id:phase,status:'passed',protectedRecords,phoneUiVerified:false,pushDeliveryVerified:false};
}

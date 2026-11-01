import assert from 'node:assert/strict';

export const notificationPhoneProtocol=[
  ['ready','check'],['publish','action'],['arrived','check'],['read','check'],['replay','action'],['retried','check'],
  ['revoke','action'],['revoked','check'],['renew','action'],['renewed','check'],['publish-new','action'],
  ['new-arrived','check'],['background-ready','check'],['revoke-background','action'],['returned','check'],
];
export const notificationPhonePhases=notificationPhoneProtocol.filter(([,kind])=>kind==='check').map(([id])=>id);
export const notificationPhoneFirstBody='Message pour vérifier l’arrivée de l’alerte QA';
export const notificationPhoneSecondBody='Message après le nouvel accord QA';
export function verifyNotificationPhoneCheckpoint(phase,before,state,identity) {
  const index=notificationPhonePhases.indexOf(phase);assert(index>=0);
  assert.equal(state.parentInbox.userId,identity.parentUid);assert.equal(state.otherInbox.userId,identity.otherUid);
  assert.deepEqual(state.parentInbox.notifications.filter(row=>!row.id.startsWith('teamChat_')),before.parentNotifications);
  assert.deepEqual(state.otherInbox.notifications.filter(row=>!row.id.startsWith('teamChat_')),before.otherNotifications);
  assert.deepEqual(state.records.claims,before.claims);assert.deepEqual(state.records.liveTrips,before.liveTrips);
  assert.deepEqual(state.disabled,before.disabled);
  let protectedRecordCount=0;
  for(const [collection,rows]of Object.entries(before.documents))for(const row of rows) {
    if(collection==='guardianVerifications'&&row.id===identity.verificationId)continue;
    assert.deepEqual(state.records.documents[collection]?.find(item=>item.id===row.id),row,`${collection}/${row.id}`);
    protectedRecordCount++;
  }
  const revoked=['revoked','returned'].includes(phase),renewed=['renewed','new-arrived','background-ready'].includes(phase);
  assert.deepEqual(state.guardian,{revision:phase==='returned'?6:renewed?5:phase==='revoked'?3:2,
    status:revoked?'revoked':'verified'});
  const first=index>=1,second=['new-arrived','background-ready','returned'].includes(phase);
  assert.equal(state.messages.length,second?2:first?1:0);assert.equal(state.operations.length,state.messages.length);
  assert.equal(state.alerts.length,state.messages.length*2);assert.equal(state.envelopes.length,state.messages.length);
  assert.equal(state.readReceipts.length,0,'Alert reads must not acknowledge team message reads');
  const messages=first?[identity.firstMessageId,...(second?[identity.newMessageId]:[])]:[];
  assert.deepEqual(state.messages.map(row=>row.id).sort(),[...messages].sort());
  assert.deepEqual(state.operations.map(row=>row.id).sort(),[...messages].sort());
  for(const row of state.messages) {
    assert.equal(row.senderUserId,identity.driverUid);
    assert.equal(row.body,row.id===identity.firstMessageId?notificationPhoneFirstBody:notificationPhoneSecondBody);
    assert.deepEqual(state.alerts.filter(note=>note.messageId===row.id).map(note=>note.userId).sort(),[identity.parentUid,identity.otherUid].sort());
  }
  for(const row of state.alerts) {
    assert(messages.includes(row.messageId));assert([identity.parentUid,identity.otherUid].includes(row.userId));
    assert.equal(row.title,'Nouveau message d’équipe');assert.equal(row.body,'Un nouveau message est disponible dans votre équipe.');
  }
  for(const row of state.envelopes) {
    assert.equal(row.status,'pending');assert(messages.includes(row.messageId));
    assert.deepEqual(row.recipientUserIds,[identity.parentUid,identity.otherUid].sort());
  }
  const parentRows=state.parentInbox.notifications.filter(row=>row.id.startsWith('teamChat_'));
  const otherRows=state.otherInbox.notifications.filter(row=>row.id.startsWith('teamChat_'));
  assert.equal(otherRows.length,state.messages.length);
  const expected=revoked||phase==='renewed'?[]:second?[identity.newNoticeId]:first?[identity.firstNoticeId]:[];
  assert.deepEqual(parentRows.map(row=>row.id),expected);
  if(first) {
    const parent=state.alerts.find(row=>row.userId===identity.parentUid&&row.messageId===identity.firstMessageId);
    assert(parent);assert.equal(parent.id,identity.firstNoticeId);
    const read=index>=notificationPhonePhases.indexOf('read');assert.equal(parent.read,read);
    if(read) {assert(parent.readAt);assert.deepEqual(parent.readAt,identity.firstReadAt);}
  }
  if(second) {
    assert.equal(state.alerts.find(row=>row.id===identity.newNoticeId)?.userId,identity.parentUid);
    assert.equal(parentRows[0]?.unread,phase==='returned'?undefined:true);
  }
  return{id:phase,status:'passed',protectedRecordCount,originalClaimsAndDisabledStatesUnchanged:true,
    liveTripsUnchanged:true,teamMessageReadReceipts:0,phoneUiProven:false,pushDeliveryVerified:false};
}

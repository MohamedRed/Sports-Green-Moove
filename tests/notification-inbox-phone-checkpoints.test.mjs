import assert from 'node:assert/strict';
import test from 'node:test';
import {notificationPhoneProtocol,notificationPhonePhases,notificationPhoneFirstBody,notificationPhoneSecondBody,
  verifyNotificationPhoneCheckpoint} from '../scripts/qa/notification-inbox-phone-checkpoints.mjs';

const identity={parentUid:'parent',driverUid:'driver',otherUid:'other',verificationId:'verification',firstMessageId:'message1',
  newMessageId:'message2',firstNoticeId:'teamChat_first-parent',newNoticeId:'teamChat_new-parent',firstReadAt:{_seconds:123}};
const before={documents:{users:[{id:'parent',data:{name:'Parent QA'}}],notifications:[{id:'ordinary',data:{read:false}}],
  guardianVerifications:[{id:'verification',data:{revision:2,status:'verified'}}]},claims:[{uid:'parent',claims:{roleKeys:['parent']}}],
  liveTrips:{protected:{status:'active'}},disabled:[{uid:'parent',disabled:false}],parentNotifications:[{id:'ordinary'}],otherNotifications:[]};
function fixture(phase) {
  const index=notificationPhonePhases.indexOf(phase),first=index>=1,second=['new-arrived','background-ready','returned'].includes(phase);
  const revoked=['revoked','returned'].includes(phase),renewed=['renewed','new-arrived','background-ready'].includes(phase);
  const read=index>=notificationPhonePhases.indexOf('read');
  const messages=first?[{id:'message1',body:notificationPhoneFirstBody,senderUserId:'driver'},
    ...(second?[{id:'message2',body:notificationPhoneSecondBody,senderUserId:'driver'}]:[])]:[];
  const alerts=messages.flatMap((row,i)=>['parent','other'].map(uid=>({id:`teamChat_${i?'new':'first'}-${uid}`,messageId:row.id,
    userId:uid,title:'Nouveau message d’équipe',body:'Un nouveau message est disponible dans votre équipe.',read:i===0&&uid==='parent'&&read,
    ...(i===0&&uid==='parent'&&read?{readAt:identity.firstReadAt}:{})})));
  const parentRows=revoked||phase==='renewed'?[]:alerts.filter(row=>row.userId==='parent'&&row.messageId===(second?'message2':'message1'))
    .map(row=>({id:row.id,unread:!row.read}));
  return structuredClone({records:before,disabled:before.disabled,guardian:{revision:phase==='returned'?6:renewed?5:phase==='revoked'?3:2,
    status:revoked?'revoked':'verified'},messages,operations:messages.map(row=>({id:row.id})),alerts,
    envelopes:messages.map(row=>({messageId:row.id,status:'pending',recipientUserIds:['other','parent']})),readReceipts:[],
    parentInbox:{userId:'parent',notifications:[...before.parentNotifications,...parentRows]},
    otherInbox:{userId:'other',notifications:alerts.filter(row=>row.userId==='other').map(row=>({id:row.id}))}});
}
test('all nine independent record phases pass without claiming phone UI or push delivery',()=>{
  assert.equal(notificationPhoneProtocol.length,15);assert.equal(notificationPhonePhases.length,9);
  for(const phase of notificationPhonePhases) {
    const result=verifyNotificationPhoneCheckpoint(phase,before,fixture(phase),identity);
    assert.equal(result.phoneUiProven,false);assert.equal(result.pushDeliveryVerified,false);
  }
});
for(const [label,mutate]of [
  ['foreign owner',s=>s.parentInbox.userId='other'],['ordinary notification mutation',s=>s.records.documents.notifications[0].data.read=true],
  ['disabled account mutation',s=>s.disabled[0].disabled=true],['role escalation',s=>s.records.claims[0].claims.roleKeys=['admin']],
  ['live trip mutation',s=>s.records.liveTrips.protected.status='ended'],['acknowledged team message',s=>s.readReceipts=[{id:'receipt'}]],
  ['duplicated alert recipient',s=>s.alerts[1].userId='parent'],['sent push envelope',s=>s.envelopes[0].status='sent'],
  ['private alert body',s=>s.alerts[0].body='private'],['extra parent history',s=>s.parentInbox.notifications.push({id:'teamChat_foreign'})],
  ['wrong guardian revision',s=>s.guardian.revision=1],['rewritten first read time',s=>s.alerts[0].readAt={_seconds:999}],
])test('checkpoint rejects '+label,()=>{
  const state=fixture('read');mutate(state);assert.throws(()=>verifyNotificationPhoneCheckpoint('read',before,state,identity));
});

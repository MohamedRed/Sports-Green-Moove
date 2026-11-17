import assert from 'node:assert/strict';
import test from 'node:test';
import {notificationRetryPhases,notificationRetryBody,notificationRetryLaterBody,notificationRetryCorruptBody,
  notificationApiCounts,verifyNotificationRetryCheckpoint} from '../scripts/qa/notification-retry-phone-checkpoints.mjs';

const identity={parentUid:'parent',otherUid:'other',driverUid:'driver',teamInstanceId:'team',firstMessageId:'first',nextMessageId:'next',
  firstNoticeId:'teamChat_first_parent',nextNoticeId:'teamChat_next_parent',firstReadAt:{seconds:1}};
function fixture(phase){
  const ordinary={id:'ordinary',unread:true},records={documents:{notifications:[{id:'ordinary',data:{userId:'parent',read:false}}]},claims:[],liveTrips:null};
  const before={...structuredClone(records),disabled:[],parentNotifications:[ordinary],otherNotifications:[]};
  const index=notificationRetryPhases.indexOf(phase),bad=['error','retry-failed'].includes(phase),messages=index===0?[]:[
    {id:'first',senderUserId:'driver',body:notificationRetryBody},...(phase==='next-arrived'?[{id:'next',senderUserId:'driver',body:notificationRetryLaterBody}]:[])];
  const alerts=messages.flatMap(message=>['parent','other'].map(userId=>({id:'teamChat_'+message.id+'_'+userId,messageId:message.id,userId,
    title:'Nouveau message d’équipe',body:bad&&userId==='parent'?notificationRetryCorruptBody:'Un nouveau message est disponible dans votre équipe.',
    read:message.id==='first'&&userId==='parent'&&index>=2,...(message.id==='first'&&userId==='parent'&&index>=2?{readAt:identity.firstReadAt}:{})})));
  const state={records,disabled:[],messages,alerts,operations:messages.map(row=>({id:row.id})),readReceipts:[],
    envelopes:messages.map(row=>({messageId:row.id,status:'pending',recipientUserIds:['other','parent']})),
    parentInbox:bad?{denied:'FAILED_PRECONDITION'}:{userId:'parent',notifications:[...messages.toReversed().map(row=>({id:'teamChat_'+row.id+'_parent'})),ordinary]},
    otherInbox:{userId:'other',notifications:messages.map(row=>({id:'teamChat_'+row.id+'_other'}))},
    apiCalls:{getInbox:2,listChatConversations:2,getNotificationInbox:phase==='retry-failed'?13:10}};
  return{before,state,prior:{error:{apiCalls:{getInbox:2,listChatConversations:2,getNotificationInbox:10}}}};
}
for(const phase of notificationRetryPhases)test('retry protocol validates '+phase+' without claiming phone UI or push',()=>{
  const{before,state,prior}=fixture(phase),result=verifyNotificationRetryCheckpoint(phase,before,state,identity,prior);
  assert.equal(result.status,'passed');assert.equal(result.phoneUiVerified,false);assert.equal(result.pushDeliveryVerified,false);
});
for(const [name,mutate]of [
  ['review reload',s=>s.apiCalls.getInbox++],['directory reload',s=>s.apiCalls.listChatConversations++],
  ['foreign new record',s=>s.records.documents.bookings=[{id:'foreign',data:{}}]],
  ['changed protected row',s=>s.records.documents.notifications[0].data.read=true],
  ['reset read timestamp',s=>s.alerts[0].readAt={seconds:2}],['message read receipt',s=>s.readReceipts=[{id:'read'}]],
  ['sent envelope',s=>s.envelopes[0].status='sent'],['duplicate alert',s=>s.alerts.push(s.alerts[0])],
])test('retry checkpoint rejects '+name,()=>{
  const{before,state,prior}=fixture('recovered');mutate(state);
  assert.throws(()=>verifyNotificationRetryCheckpoint('recovered',before,state,identity,prior));
});
test('failed retry counts only its one phone read plus two explicit observer reads',()=>{
  const{before,state,prior}=fixture('retry-failed');state.apiCalls.getNotificationInbox++;
  assert.throws(()=>verifyNotificationRetryCheckpoint('retry-failed',before,state,identity,prior));
});
test('only allowlisted endpoint names are counted, without retaining tokens or request contents',()=>{
  assert.deepEqual(notificationApiCounts('Beginning execution of "us-central1-getInbox"\nBeginning execution of "us-central1-getNotificationInbox"\nBeginning execution of "us-central1-listChatConversations"\nBearer private-input'),
    {getInbox:1,listChatConversations:1,getNotificationInbox:1});
});

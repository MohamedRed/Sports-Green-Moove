import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {existsSync,mkdirSync,readFileSync,statSync,writeFileSync} from 'node:fs';
import {dirname,isAbsolute,resolve} from 'node:path';
import {createInterface} from 'node:readline';
import {notificationRetryProtocol,notificationRetryBody,notificationRetryLaterBody,notificationRetryCorruptBody,
  notificationApiCounts,verifyNotificationRetryCheckpoint} from './notification-retry-phone-checkpoints.mjs';
import {snapshotSessionRestorationRecords} from './session-restoration-records.mjs';
import {withLocalAdminCleanup} from './local-admin-lifecycle.mjs';

const [path,output,log]=process.argv.slice(2);
assert.equal(process.argv.length,5);assert([path,output,log].every(file=>isAbsolute(file??''))&&!existsSync(output)&&process.stdin.isTTY);
for(const file of[path,dirname(path)])assert.equal(statSync(file).mode&0o077,0);
const session=JSON.parse(readFileSync(path));assert.equal(session.projectId,'demo-sgm-local-qa');assert.match(session.runId,/^[a-f0-9]{32}$/);
process.env.SGM_QA_PASSWORD=session.password;
const {auth,call,db}=await import('./local-flow-client.mjs');
const {prepareTeamAlertFixture}=await import('./team-alert-fixture.mjs');
const {getDatabase}=await import('firebase-admin/database');const {deleteApp}=await import('firebase-admin/app');
mkdirSync(output,{mode:0o700});
const save=(name,value)=>writeFileSync(resolve(output,name+'.json'),JSON.stringify(value,null,2)+'\n',{mode:0o600,flag:'wx'});
const json=value=>JSON.parse(JSON.stringify(value)),checkpoints=[],actions=[],prior={};
const disabled=async()=>(await auth.listUsers(1000)).users.map(user=>({uid:user.uid,disabled:user.disabled})).sort((a,b)=>a.uid.localeCompare(b.uid));
const input=createInterface({input:process.stdin,terminal:false}),stop=()=>input.close();
process.once('SIGINT',stop);process.once('SIGTERM',stop);
let completed=false,failed=false,adminClientClosed=false,firestoreClientTerminated=false,identity;
try{
  await withLocalAdminCleanup(async()=>{
    const f=await prepareTeamAlertFixture(),{parent,driver,otherAdult}=f.actors;
    identity={teamId:f.teamId,teamInstanceId:f.target.expectedTeamInstanceId,parentUid:parent.uid,driverUid:driver.uid,otherUid:otherAdult.uid};
    const root=db.collection('teamConversations').doc(identity.teamInstanceId);
    const baseline=json({...await snapshotSessionRestorationRecords(db,auth,getDatabase()),disabled:await disabled(),
      parentNotifications:(await call('getNotificationInbox',parent)).notifications,
      otherNotifications:(await call('getNotificationInbox',otherAdult)).notifications});save('baseline',baseline);
    const rows=async collection=>(await db.collection(collection).where('teamInstanceId','==',identity.teamInstanceId).get()).docs.map(row=>({id:row.id,...row.data()}));
    let position=0;
    console.log('Isolated alert retry observer ready: '+notificationRetryProtocol.map(([id])=>id).join(', ')+', finish.');
    for await(const command of input){
      const phase=command.trim();if(phase==='stop')break;
      if(phase==='finish'){assert.equal(position,notificationRetryProtocol.length);completed=true;break;}
      const expected=notificationRetryProtocol[position];assert(expected&&phase===expected[0],'Execute each phase once in order');
      if(expected[1]==='action'){
        if(phase==='publish'||phase==='publish-next'){
          const message=await call('sendTeamChatMessage',driver,{...f.target,body:phase==='publish'?notificationRetryBody:notificationRetryLaterBody,clientMessageId:randomUUID()});
          assert.equal(message.reused,false);const notice=(await rows('teamChatNotifications')).find(row=>row.messageId===message.messageId&&row.userId===parent.uid);assert(notice);
          identity[phase==='publish'?'firstMessageId':'nextMessageId']=message.messageId;
          identity[phase==='publish'?'firstNoticeId':'nextNoticeId']=notice.id;
        }else await db.collection('teamChatNotifications').doc(identity.firstNoticeId).update({body:phase==='corrupt'?notificationRetryCorruptBody:'Un nouveau message est disponible dans votre équipe.'});
        actions.push(phase);console.log('Isolated action completed: '+phase);
      }else{
        const apiCalls=notificationApiCounts(readFileSync(log,'utf8'));let parentInbox;
        if(['error','retry-failed'].includes(phase)){
          await assert.rejects(()=>call('getNotificationInbox',parent),error=>error.code==='FAILED_PRECONDITION');parentInbox={denied:'FAILED_PRECONDITION'};
        }else parentInbox=await call('getNotificationInbox',parent);
        const state=json({records:await snapshotSessionRestorationRecords(db,auth,getDatabase()),disabled:await disabled(),apiCalls,parentInbox,
          otherInbox:await call('getNotificationInbox',otherAdult),messages:(await root.collection('entries').orderBy('sequence').get()).docs.map(row=>({id:row.id,...row.data()})),
          operations:await rows('teamMessageOperations'),alerts:await rows('teamChatNotifications'),envelopes:await rows('teamPushOutbox'),
          readReceipts:(await root.collection('readReceipts').get()).docs.map(row=>({id:row.id,...row.data()}))});
        if(phase==='read')identity.firstReadAt=state.alerts.find(row=>row.id===identity.firstNoticeId)?.readAt;
        save(phase+'-attempt',{projectId:session.projectId,runId:session.runId,observedAt:new Date().toISOString(),identity:{...identity},state});
        const check=verifyNotificationRetryCheckpoint(phase,baseline,state,identity,prior);prior[phase]=state;
        save(phase,{projectId:session.projectId,runId:session.runId,observedAt:new Date().toISOString(),identity:{...identity},state,check});
        checkpoints.push(check);console.log('Independent retry checkpoint passed: '+phase);
      }position++;
    }
  },{firestore:{terminate:async()=>{await db.terminate();firestoreClientTerminated=true;}},closeApp:async app=>{await deleteApp(app);adminClientClosed=true;}});
}catch{failed=true;}finally{input.close();process.removeListener('SIGINT',stop);process.removeListener('SIGTERM',stop);delete process.env.SGM_QA_PASSWORD;}
const sources=['scripts/qa/manual-notification-retry-phone.mjs','scripts/qa/notification-retry-phone-checkpoints.mjs','scripts/qa/team-alert-fixture.mjs',
  'android/app/src/main/java/be/sportgreenmoove/app/ui/MessagesInboxRoute.kt','android/app/src/main/java/be/sportgreenmoove/app/ui/NotificationInboxState.kt'];
save('results',{projectId:session.projectId,runId:session.runId,identity,observedAt:new Date().toISOString(),scope:'independent-retry-records-not-phone-or-push-proof',
  completed:completed&&!failed,failed,checkpoints,actions,adminClientClosed,firestoreClientTerminated,productionWrites:false,mapRequests:0,realPayments:false,
  phoneUiVerified:false,pushDeliveryVerified:false,sourceFiles:Object.fromEntries(sources.map(file=>[file,createHash('sha256').update(readFileSync(resolve(import.meta.dirname,'../..',file))).digest('hex')]))});
if(failed)throw new Error('Alert retry observer failed; retain its incomplete attempt.');

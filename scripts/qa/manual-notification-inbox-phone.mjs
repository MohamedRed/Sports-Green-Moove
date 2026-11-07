import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {existsSync,mkdirSync,readFileSync,statSync,writeFileSync} from 'node:fs';
import {dirname,isAbsolute,resolve} from 'node:path';
import {createInterface} from 'node:readline';
import {notificationPhoneProtocol,notificationPhoneFirstBody,notificationPhoneSecondBody,verifyNotificationPhoneCheckpoint} from './notification-inbox-phone-checkpoints.mjs';
import {snapshotSessionRestorationRecords} from './session-restoration-records.mjs';
import {withLocalAdminCleanup} from './local-admin-lifecycle.mjs';

const [path,output]=process.argv.slice(2);
assert.equal(process.argv.length,4);assert(isAbsolute(path??'')&&isAbsolute(output??'')&&!existsSync(output)&&process.stdin.isTTY);
for(const file of[path,dirname(path)])assert.equal(statSync(file).mode&0o077,0);
const session=JSON.parse(readFileSync(path));assert.equal(session.projectId,'demo-sgm-local-qa');assert.match(session.runId,/^[a-f0-9]{32}$/);
process.env.SGM_QA_PASSWORD=session.password;
const {auth,call,db}=await import('./local-flow-client.mjs');
const {prepareTeamAlertFixture}=await import('./team-alert-fixture.mjs');
const {getDatabase}=await import('firebase-admin/database');const {deleteApp}=await import('firebase-admin/app');
mkdirSync(output,{mode:0o700});
const save=(file,value)=>writeFileSync(resolve(output,file+'.json'),JSON.stringify(value,null,2)+'\n',{mode:0o600,flag:'wx'});
const json=value=>JSON.parse(JSON.stringify(value));
const disabled=async()=>(await auth.listUsers(1000)).users.map(user=>({uid:user.uid,disabled:user.disabled})).sort((a,b)=>a.uid.localeCompare(b.uid));
const input=createInterface({input:process.stdin,terminal:false}),checkpoints=[],actions=[];
const stop=()=>input.close();process.once('SIGINT',stop);process.once('SIGTERM',stop);
let completed=false,failed=false,adminClientClosed=false,firestoreClientTerminated=false,identity;
try {
  await withLocalAdminCleanup(async()=>{
    const f=await prepareTeamAlertFixture(),{parent,driver,otherAdult}=f.actors;
    identity={teamId:f.teamId,teamInstanceId:f.target.expectedTeamInstanceId,parentUid:parent.uid,driverUid:driver.uid,
      otherUid:otherAdult.uid,verificationId:f.parentVerificationId};
    const root=db.collection('teamConversations').doc(identity.teamInstanceId);
    const baseline=json({...await snapshotSessionRestorationRecords(db,auth,getDatabase()),disabled:await disabled(),
      parentNotifications:(await call('getNotificationInbox',parent)).notifications,
      otherNotifications:(await call('getNotificationInbox',otherAdult)).notifications});save('baseline',baseline);
    const firstRequest={...f.target,body:notificationPhoneFirstBody,clientMessageId:randomUUID()};
    const rows=async(collection)=>(await db.collection(collection).where('teamInstanceId','==',identity.teamInstanceId).get()).docs
      .map(row=>({id:row.id,...row.data()}));
    let position=0;
    console.log('Phone alert observer ready. Observe the phone before each check: '+notificationPhoneProtocol.map(([id])=>id).join(', ')+', finish.');
    for await(const command of input) {
      const phase=command.trim();if(phase==='stop')break;
      if(phase==='finish'){assert.equal(position,notificationPhoneProtocol.length);completed=true;break;}
      const expected=notificationPhoneProtocol[position];assert(expected&&phase===expected[0],'Execute each exact phase once in order');
      if(expected[1]==='action') {
        if(phase==='publish'||phase==='publish-new') {
          const response=await call('sendTeamChatMessage',driver,phase==='publish'?firstRequest:
            {...f.target,body:notificationPhoneSecondBody,clientMessageId:randomUUID()});
          assert.equal(response.reused,false);
          const note=(await rows('teamChatNotifications')).find(row=>row.messageId===response.messageId&&row.userId===parent.uid);
          assert(note);identity[phase==='publish'?'firstMessageId':'newMessageId']=response.messageId;
          identity[phase==='publish'?'firstNoticeId':'newNoticeId']=note.id;
        } else if(phase==='replay') {
          const response=await call('sendTeamChatMessage',driver,firstRequest);assert.equal(response.reused,true);
          assert.equal(response.messageId,identity.firstMessageId);
        } else if(phase==='renew') {await f.guardian(parent,'request',3);await f.guardian(parent,'verify',4);}
        else await f.guardian(parent,'revoke',phase==='revoke'?2:5);
        actions.push(phase);console.log('Authenticated isolated action completed: '+phase+'. No phone UI or push delivery is implied.');
      } else {
        const state=json({records:await snapshotSessionRestorationRecords(db,auth,getDatabase()),disabled:await disabled(),
          guardian:((row)=>({status:row.status,revision:row.revision}))((await db.doc(`guardianVerifications/${identity.verificationId}`).get()).data()),
          parentInbox:await call('getNotificationInbox',parent),otherInbox:await call('getNotificationInbox',otherAdult),
          messages:(await root.collection('entries').orderBy('sequence').get()).docs.map(row=>({id:row.id,...row.data()})),
          operations:await rows('teamMessageOperations'),alerts:await rows('teamChatNotifications'),envelopes:await rows('teamPushOutbox'),
          readReceipts:(await root.collection('readReceipts').get()).docs.map(row=>({id:row.id,...row.data()}))});
        if(phase==='read')identity.firstReadAt=state.alerts.find(row=>row.id===identity.firstNoticeId)?.readAt;
        const check=verifyNotificationPhoneCheckpoint(phase,baseline,state,identity);
        save(phase,{projectId:session.projectId,runId:session.runId,observedAt:new Date().toISOString(),identity:{...identity},state,check});
        checkpoints.push(check);console.log('Independent notification record checkpoint passed: '+phase);
      }
      position++;
    }
  },{firestore:{terminate:async()=>{await db.terminate();firestoreClientTerminated=true;}},
    closeApp:async app=>{await deleteApp(app);adminClientClosed=true;}});
} catch {failed=true;}
finally {input.close();process.removeListener('SIGINT',stop);process.removeListener('SIGTERM',stop);delete process.env.SGM_QA_PASSWORD;}
const sources=['scripts/qa/manual-notification-inbox-phone.mjs','scripts/qa/notification-inbox-phone-checkpoints.mjs',
  'scripts/qa/team-alert-fixture.mjs','scripts/qa/session-restoration-records.mjs','functions/src/callables/notificationInbox.ts'];
save('results',{projectId:session.projectId,runId:session.runId,identity,observedAt:new Date().toISOString(),
  scope:'independent-notification-records-not-native-arrival-or-background-push-proof',completed:completed&&!failed,failed,
  checkpoints,actions,adminClientClosed,firestoreClientTerminated,productionWrites:false,mapRequests:0,realPayments:false,
  phoneUiProvenByObserver:false,pushDeliveryVerified:false,managerUiProven:false,
  sourceFiles:Object.fromEntries(sources.map(file=>[file,createHash('sha256').update(readFileSync(resolve(import.meta.dirname,'../..',file))).digest('hex')]))});
if(failed)throw new Error('Notification inbox observer failed; retain the incomplete attempt.');

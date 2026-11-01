import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {existsSync,mkdirSync,readFileSync,statSync,writeFileSync} from 'node:fs';
import {dirname,isAbsolute,resolve} from 'node:path';
import {createInterface} from 'node:readline';
import {chatAccountSwitchPhases,verifyChatAccountSwitchCheckpoint} from './chat-account-switch-checkpoints.mjs';
import {snapshotSessionRestorationRecords} from './session-restoration-records.mjs';
import {withLocalAdminCleanup} from './local-admin-lifecycle.mjs';

const [path,output]=process.argv.slice(2);
assert.equal(process.argv.length,4);assert(isAbsolute(path??'')&&isAbsolute(output??'')&&!existsSync(output)&&process.stdin.isTTY);
for(const file of [path,dirname(path)]) assert.equal(statSync(file).mode&0o077,0);
const session=JSON.parse(readFileSync(path));assert.equal(session.projectId,'demo-sgm-local-qa');assert.match(session.runId,/^[a-f0-9]{32}$/);
process.env.SGM_QA_PASSWORD=session.password;
const {auth,call,db,signIn,tripInput,viewedBooking}=await import('./local-flow-client.mjs');
const {getDatabase}=await import('firebase-admin/database');const {deleteApp}=await import('firebase-admin/app');
mkdirSync(output,{mode:0o700});
const save=(file,value)=>writeFileSync(resolve(output,file+'.json'),JSON.stringify(value,null,2)+'\n',{flag:'wx',mode:0o600});
const input=createInterface({input:process.stdin,terminal:false}),checkpoints=[];
const stop=()=>input.close();process.once('SIGINT',stop);process.once('SIGTERM',stop);
let fixture,completed=false,failed=false,adminClientClosed=false,firestoreClientTerminated=false;
try {
  await withLocalAdminCleanup(async()=>{
    const parent=await signIn(session.parent),driver=await signIn(session.driver);
    await call('initializeUserProfile',parent);await call('initializeUserProfile',driver);
    const {tripId}=await call('createTrip',driver,{...tripInput(),title:'Trajet confidentialité message QA'});
    const {bookingId}=await call('requestBooking',parent,await viewedBooking(parent,{tripId,seats:1}));
    await call('approveBooking',driver,{bookingId});fixture={tripId,bookingId,parentUid:parent.uid,driverUid:driver.uid};
    save('fixture',{projectId:session.projectId,runId:session.runId,fixture,controllerSubmittedChatMessages:0});
    const baseline=await snapshotSessionRestorationRecords(db,auth,getDatabase());save('baseline',baseline);
    verifyChatAccountSwitchCheckpoint('ready',baseline,baseline,fixture);
    console.log('Independent account-switch observer ready: '+chatAccountSwitchPhases.join(', ')+', finish.');
    for await(const command of input) {
      const phase=command.trim();if(phase==='stop')break;
      if(phase==='finish'){assert.equal(checkpoints.length,chatAccountSwitchPhases.length);completed=true;break;}
      assert.equal(phase,chatAccountSwitchPhases[checkpoints.length]);
      const state=await snapshotSessionRestorationRecords(db,auth,getDatabase());
      const check=verifyChatAccountSwitchCheckpoint(phase,baseline,state,fixture);
      save(phase,{projectId:session.projectId,runId:session.runId,observedAt:new Date().toISOString(),state,check});
      checkpoints.push(check);console.log('Independent account-switch checkpoint passed: '+phase);
    }
  },{firestore:{terminate:async()=>{await db.terminate();firestoreClientTerminated=true;}},
    closeApp:async app=>{await deleteApp(app);adminClientClosed=true;}});
} catch {failed=true;}
finally {input.close();process.removeListener('SIGINT',stop);process.removeListener('SIGTERM',stop);delete process.env.SGM_QA_PASSWORD;}
const sources=['scripts/qa/manual-chat-account-switch-phone.mjs','scripts/qa/chat-account-switch-checkpoints.mjs',
  'scripts/qa/chat-network-phone-checkpoints.mjs','scripts/qa/session-restoration-records.mjs'];
save('results',{projectId:session.projectId,runId:session.runId,fixture,observedAt:new Date().toISOString(),
  scope:'independent-chat-records-not-account-ui-isolation-or-original-request-identity',completed:completed&&!failed,
  failed,checkpoints,adminClientClosed,firestoreClientTerminated,controllerSubmittedChatMessages:false,
  productionWrites:false,mapRequests:0,realPayments:false,accountUiIsolationProvenByObserver:false,
  originalPendingIdentityProvenByObserver:false,postCommitResponseLossExercised:false,
  sourceFiles:Object.fromEntries(sources.map(file=>[file,createHash('sha256').update(readFileSync(resolve(import.meta.dirname,'../..',file))).digest('hex')]))});
if(failed)throw new Error('Account-switch observer failed; retain the incomplete attempt.');

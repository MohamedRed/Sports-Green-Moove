import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { deleteApp, getApp } from 'firebase-admin/app';
import { bookingRequestPhonePhases, verifyBookingRequestPhoneState } from './booking-request-phone-checkpoints.mjs';

const [sessionPath,output]=process.argv.slice(2);
assert(isAbsolute(sessionPath??'') && isAbsolute(output??'') && process.stdin.isTTY);
assert.equal(statSync(sessionPath).mode&0o077,0);
const session=JSON.parse(readFileSync(sessionPath));assert.equal(session.projectId,'demo-sgm-local-qa');
assert.match(session.runId,/^[a-f0-9]{32}$/);process.env.SGM_QA_PASSWORD=session.password;
const {auth,call,db,signIn,tripInput}=await import('./local-flow-client.mjs');
const {snapshotNotificationReadRecords}=await import('./local-notification-read-ui.mjs');
const snapshot=async()=>JSON.parse(JSON.stringify(await snapshotNotificationReadRecords()));
mkdirSync(output,{mode:0o700});
const input=createInterface({input:process.stdin,terminal:false}),checkpoints=[];
const stop=()=>input.close();process.once('SIGINT',stop);process.once('SIGTERM',stop);
let failure,completed=false,baseline,fixture,readState,requestedState;
try {
  const actors={parent:await signIn(session.parent),driver:await signIn(session.driver),outsider:await signIn(session.outsider)};
  for(const actor of [actors.parent,actors.driver]) await call('initializeUserProfile',actor);
  const title='Demande conducteur QA';
  const {tripId}=await call('createTrip',actors.driver,{...tripInput(),title,departureAt:new Date(Date.now()+2*3600_000).toISOString()});
  fixture={tripId,title,parentUid:actors.parent.uid,driverUid:actors.driver.uid};baseline=await snapshot();
  console.log('Isolated upcoming trip ready: '+title+'. Observe '+bookingRequestPhonePhases.join(', ')+', then finish.');
  console.log('Only the phone may request or mark a notice read; this observer never does either.');
  for await(const command of input) {
    const phase=command.trim();if(phase==='stop') break;
    if(phase==='finish') {assert.equal(checkpoints.length,bookingRequestPhonePhases.length);completed=true;break;}
    assert.equal(phase,bookingRequestPhonePhases[checkpoints.length]);
    const records=await snapshot(),bookings=(records.documents.bookings??[]).filter(row=>row.data.tripId===tripId);
    const bookingIds=new Set(bookings.map(row=>row.id));
    const notices=(records.documents.notifications??[]).filter(row=>bookingIds.has(row.data.sourceId));
    const receipts=(records.documents.bookingRequestReceipts??[]).filter(row=>bookingIds.has(row.data.response?.bookingId));
    const inboxes={};
    for(const [name,actor] of Object.entries(actors)) inboxes[name]=(await call('getInbox',actor)).inbox.notifications.filter(row=>notices.some(note=>note.id===row.id));
    const pendingRequestIds=(await call('listDriverBookingRequests',actors.driver)).bookings.filter(row=>row.status==='requested').map(row=>row.bookingId);
    const state={records,bookings,notices,receipts,inboxes,pendingRequestIds,trip:records.documents.trips.find(row=>row.id===tripId).data};
    const result=verifyBookingRequestPhoneState(phase,state,baseline,fixture);
    if(phase==='parent-requested') requestedState=state.records;
    if(phase==='driver-unread') assert.deepEqual(state.records,requestedState);
    if(phase==='driver-read') readState=state.records;
    if(['parent-returned','driver-returned'].includes(phase)) assert.deepEqual(state.records,readState,'Account return must preserve the first read timestamp and every record');
    assert.deepEqual(await snapshot(),records,'Independent inbox observations must not change stored records');
    writeFileSync(resolve(output,phase+'.json'),JSON.stringify({projectId:session.projectId,runId:session.runId,recordedAt:new Date().toISOString(),fixture,baseline,state,result},null,2)+'\n',{mode:0o600,flag:'wx'});
    checkpoints.push(result);console.log('Independent request-notice checkpoint passed: '+phase);
  }
} catch(error) {failure=error;}
finally {
  input.close();process.removeListener('SIGINT',stop);process.removeListener('SIGTERM',stop);
  await deleteApp(getApp());delete process.env.SGM_QA_PASSWORD;
}
const sources=['scripts/qa/manual-booking-request-phone-session.mjs','scripts/qa/booking-request-phone-checkpoints.mjs',
  'functions/src/callables/bookingRequests.ts','functions/src/lib/bookingNotifications.ts','functions/src/callables/notificationRead.ts'];
writeFileSync(resolve(output,'session-results.json'),JSON.stringify({projectId:session.projectId,runId:session.runId,testedAt:new Date().toISOString(),
  scope:'independent-booking-request-notice-checkpoints-not-phone-ui-proof',completed:completed&&!failure,checkpoints,fixture,
  protectedRecordCount:baseline?Object.values(baseline.documents).reduce((n,rows)=>n+rows.length,0):0,
  adminClientClosed:true,physicalUiProven:false,wholeProcessRestartProven:false,pushDeliveryProven:false,productionWrites:false,
  sourceFiles:Object.fromEntries(sources.map(file=>[file,createHash('sha256').update(readFileSync(resolve(import.meta.dirname,'../..',file))).digest('hex')]))},null,2)+'\n',{mode:0o600,flag:'wx'});
if(failure) throw new Error(String(failure.message).replaceAll(session.password,'[REDACTED]'));
console.log('Request-notice observer closed; dispose of the owned backend, helper and phone separately.');

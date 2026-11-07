import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {copyFileSync,existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve,isAbsolute} from 'node:path';
import {notificationRetryPhases,verifyNotificationRetryCheckpoint} from './notification-retry-phone-checkpoints.mjs';

const root=resolve(import.meta.dirname,'../..'),trial=process.argv[2];
assert(isAbsolute(trial??'')&&trial.startsWith('/private/tmp/sgm-notification-retry-phone-'));
assert(!existsSync(resolve(trial,'session.json')),'Dispose private inputs before retaining evidence');
const json=file=>JSON.parse(readFileSync(resolve(trial,file))),run=json('records/results.json'),baseline=json('records/baseline.json');
assert.equal(run.completed,true);assert.equal(run.failed,false);assert.equal(run.checkpoints.length,7);
const prior={};for(const phase of notificationRetryPhases){
  const point=json('records/'+phase+'.json');assert.equal(point.runId,run.runId);
  assert.deepEqual(verifyNotificationRetryCheckpoint(phase,baseline,point.state,point.identity,prior),point.check);prior[phase]=point.state;
}
const build=json('build.json'),disposal=json('disposal.json');
assert.equal(build.focusedUnitTests,14);assert.equal(build.unitTests,695);assert.equal(build.componentTestsExecuted,false);
assert.equal(disposal.ownedProcessesAbsent,true);assert.equal(disposal.privateSessionRemoved,true);assert.equal(disposal.originalClipboardRestored,true);
const base=resolve(root,'docs/release/evidence/notification-retry-phone-2026-11-01');assert(!existsSync(base));mkdirSync(base);
const files=['build.json','disposal.json','clipboard-state.json','capture-stages.json','device-release-ax.txt',
  ...notificationRetryPhases.map(phase=>(phase==='ready'?'initial':phase)+'.png'),
  'TEST-be.sportgreenmoove.app.ui.NotificationInboxStateTest.xml',
  'TEST-be.sportgreenmoove.app.ui.MessagesNotificationPollingTest.xml','TEST-be.sportgreenmoove.app.services.NotificationInboxWireTest.xml'];
for(const name of files)copyFileSync(resolve(trial,name),resolve(base,name));
mkdirSync(resolve(base,'records'));
for(const name of ['baseline','results',...notificationRetryPhases])copyFileSync(resolve(trial,'records',name+'.json'),resolve(base,'records',name+'.json'));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex'),sourceFiles={...run.sourceFiles,...build.sourceFiles};
for(const file of ['scripts/qa/record-notification-inbox-disposal.mjs','scripts/qa/record-notification-inbox-build.mjs'])
  sourceFiles[file]=sha(readFileSync(resolve(root,file)));
for(const [file,hash]of Object.entries(sourceFiles)){
  const bytes=readFileSync(resolve(root,file));assert.equal(sha(bytes),hash,'Tested source changed: '+file);
  const target=resolve(root,'docs/release/evidence/source-archive',hash+'.txt');
  if(!existsSync(target))writeFileSync(target,bytes,{flag:'wx'});else assert.equal(sha(readFileSync(target)),hash);
}
writeFileSync(resolve(base,'run.json'),JSON.stringify({
  scope:'physical-android-notification-only-retry-not-closed-app-push',testedAt:run.observedAt,runId:run.runId,
  reportedDevice:'Google Pixel 9 Pro',reportedAndroidVersion:'15',physicalDevice:true,
  failedRetryObserved:true,recoveredReadStateObserved:true,subsequentAutomaticArrivalObserved:true,
  unrelatedListReloadsObserved:0,protectedRecords:198,checkpoints:7,focusedUnitTests:14,fullUnitTests:695,
  componentTestsCompiled:true,componentTestsExecutedLocally:false,reviewPaginationPhysicallyVerified:false,
  installedApkIndependentlyHashed:false,wholeHeadAttested:false,phonePeerUsed:false,managerUiExecuted:false,
  pushDeliveryVerified:false,physicalGpsVerified:false,realRadioLossVerified:false,iosExecuted:false,
  productionWrites:false,realPayments:false,mapRequests:0,videoRecorded:false,nativeExports:false,
  earlierCaptureFailureOverridden:false,releaseEvidenceAccepted:false,sourceFiles,
  publishedCaptures:{'team-alert-retry-error':'error.png','team-alert-retry-recovered':'recovered.png','team-alert-retry-next':'next-arrived.png'},
},null,2)+'\n',{flag:'wx'});
const retained=[...files,...['baseline','results',...notificationRetryPhases].map(name=>'records/'+name+'.json'),'run.json'];
writeFileSync(resolve(base,'artifact-sha256.json'),JSON.stringify(Object.fromEntries(retained.sort().map(file=>[file,sha(readFileSync(resolve(base,file)))])),null,2)+'\n',{flag:'wx'});
console.log('Retained seven phone retry checkpoints, fourteen JVM cases and three reviewed session crops. Closed-app push remains unproven.');

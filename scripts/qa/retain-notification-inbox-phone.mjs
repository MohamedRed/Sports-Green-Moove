import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {copyFileSync,existsSync,mkdirSync,readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {execFileSync} from 'node:child_process';
import {verifyNotificationPhoneCheckpoint,notificationPhonePhases} from './notification-inbox-phone-checkpoints.mjs';

const root=resolve(import.meta.dirname,'../..'),[first,verified,services]=process.argv.slice(2);
assert(first?.startsWith('/private/tmp/sgm-notification-inbox-phone-')&&verified?.startsWith('/private/tmp/sgm-notification-inbox-privacy-'));
const base=resolve(root,'docs/release/evidence/notification-inbox-phone-2026-11-01');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex'),json=file=>JSON.parse(readFileSync(file));
const copy=(source,target)=>{mkdirSync(dirname(target),{recursive:true});assert(!existsSync(target));copyFileSync(source,target);};
const archive=files=>{for(const [file,expected]of Object.entries(files)) {
  const bytes=readFileSync(resolve(root,file));assert.equal(sha(bytes),expected,file);
  const target=resolve(root,'docs/release/evidence/source-archive',expected+'.txt');
  if(!existsSync(target))writeFileSync(target,bytes,{flag:'wx'});
}};
const reports={};
for(const [label,source]of [['first',first],['verified',verified]]) {
  const run=json(resolve(source,'records/results.json'));assert.equal(run.completed,true);assert.equal(run.failed,false);
  assert.equal(run.checkpoints.length,9);assert.equal(run.adminClientClosed,true);assert.equal(run.firestoreClientTerminated,true);
  const baseline=json(resolve(source,'records/baseline.json'));
  for(const phase of notificationPhonePhases) {
    const point=json(resolve(source,'records',phase+'.json'));assert.equal(point.runId,run.runId);
    assert.deepEqual(verifyNotificationPhoneCheckpoint(phase,baseline,point.state,point.identity),point.check);
  }
  const build=json(resolve(source,'build.json'));archive(build.sourceFiles);archive(run.sourceFiles);
  const captures=json(resolve(source,'capture-stages.json'));assert.equal(captures.length,11);
  const files=['build.json','capture-stages.json','disposal.json','device-release-ax.txt',...Object.keys(build.junitFiles),
    ...captures.map(row=>row.stage+'.png'),...readdirSync(resolve(source,'records')).map(file=>'records/'+file)];
  for(const file of files)copy(resolve(source,file),resolve(base,label,file));
  reports[label]={runId:run.runId,testedAt:run.observedAt,apkHash:build.apk.sha256};
}
const service=json(services);assert.equal(service.completed,true);assert.equal(service.steps.length,7);
assert.equal(service.isolatedEnvironmentDestroyed,true);archive(service.sourceFiles);copy(services,resolve(base,'services.json'));
function pixels(file) {
  const bytes=execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-i',file,'-vf','crop=125:120:38:90',
    '-frames:v','1','-f','rawvideo','-pix_fmt','rgb24','pipe:1']);
  let sum=0,squares=0,min=255,max=0;for(const value of bytes){sum+=value;squares+=value*value;min=Math.min(min,value);max=Math.max(max,value);}
  const mean=sum/bytes.length;return{sha256:sha(readFileSync(file)),region:{left:38,top:90,width:125,height:120},
    mean,stdDev:Math.sqrt(squares/bytes.length-mean*mean),min,max};
}
const preview={first:pixels(resolve(first,'recents-stale-preview.png')),verified:pixels(resolve(verified,'recents-protected-preview.png'))};
assert(preview.first.stdDev>15&&preview.first.min<100);assert.equal(preview.verified.stdDev,0);assert.equal(preview.verified.mean,250);
writeFileSync(resolve(base,'preview-samples.json'),JSON.stringify(preview,null,2)+'\n',{flag:'wx'});
const sourceFiles=Object.assign({},service.sourceFiles,json(resolve(verified,'build.json')).sourceFiles,
  json(resolve(verified,'records/results.json')).sourceFiles);
const run={testedAt:reports.verified.testedAt,scope:'physical-android-in-app-team-alerts-not-closed-app-push',reports,sourceFiles,
  requestedCaptureDimensions:{width:198,height:443},actualCaptureDimensions:{width:198,height:442},
  physicalDevice:true,androidApi:35,inAppArrivalObserved:true,confirmedReadObserved:true,revocationObserved:true,
  renewalHidesOldAlertsObserved:true,backgroundReturnObserved:true,protectedTaskPreviewObserved:true,
  phonePeerUsed:false,managerUiExecuted:false,installedApkIndependentlyHashed:false,wholeHeadAttested:false,
  pushDeliveryVerified:false,tapNavigationVerified:false,iosExecuted:false,physicalGpsVerified:false,productionWrites:false,
  realPayments:false,mapRequests:0,videoRecorded:false,nativeExports:false,firstPreviewAccepted:false,releaseEvidenceAccepted:false,
  publishedCaptures:Object.fromEntries(['arrived','read','revoked','returned'].map(phase=>['team-alert-phone-'+phase,'verified/'+phase+'.png']))};
writeFileSync(resolve(base,'run.json'),JSON.stringify(run,null,2)+'\n',{flag:'wx'});
function inventory(folder,prefix='') {return readdirSync(folder,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()
  ?inventory(resolve(folder,entry.name),prefix+entry.name+'/'):[prefix+entry.name]);}
const files=inventory(base).filter(file=>file!=='artifact-sha256.json');
writeFileSync(resolve(base,'artifact-sha256.json'),JSON.stringify(Object.fromEntries(files.map(file=>[file,sha(readFileSync(resolve(base,file)))])),null,2)+'\n',{flag:'wx'});
console.log('Retained both phone sessions, negative/positive previews, independent records, build sources and seven callable cases.');

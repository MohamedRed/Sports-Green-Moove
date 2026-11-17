import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {copyFileSync,existsSync,mkdirSync,readFileSync,readdirSync,statSync,writeFileSync} from 'node:fs';
import {resolve,isAbsolute} from 'node:path';
const root=resolve(import.meta.dirname,'../..'),download=process.argv[2];assert(isAbsolute(download??''));
const base=resolve(root,'docs/release/evidence/notification-gate-d476cce-2026-11-01');
if(existsSync(base))assert.deepEqual(readdirSync(base),['README.md']);else mkdirSync(base);
const gh=(...args)=>JSON.parse(execFileSync('/opt/homebrew/bin/gh',args,{encoding:'utf8',maxBuffer:8*1024*1024}));
const save=(file,row)=>writeFileSync(resolve(base,file),JSON.stringify(row,null,2)+'\n',{flag:'wx'});
const run=gh('run','view','41303552983','--repo','MohamedRed/Sports-Green-Moove','--json','headSha,databaseId,status,conclusion,jobs,url');
assert.equal(run.headSha,'d476cce5a4210e0d6e2dc95668d8f875cdefed73');assert.equal(run.status,'completed');assert.equal(run.conclusion,'success');
save('native-run.json',run);save('artifact.json',gh('api','repos/MohamedRed/Sports-Green-Moove/actions/artifacts/13083535043'));
save('head-checks.json',gh('api','repos/MohamedRed/Sports-Green-Moove/commits/'+run.headSha+'/check-runs?per_page=100'));
const ordinary=resolve(download,'outputs/store-review-screenshots');
for(const file of ['ordinary-instrumentation.txt','ordinary-results.json','native-suite-status.json','disposable-store-restore.json','disposable-device-setup.json'])
  copyFileSync(resolve(ordinary,file),resolve(base,file));
copyFileSync(resolve(download,'outputs/androidTest-results/connected/debug/TEST-guarded-components.xml'),resolve(base,'guarded-components.xml'));
const parents=readdirSync(resolve(download,'outputs/local-ui-evidence'));
const found=parents.filter(id=>existsSync(resolve(download,'outputs/local-ui-evidence',id,'results.json')));assert.equal(found.length,1);
const replay=resolve(download,'outputs/local-ui-evidence',found[0]);mkdirSync(resolve(base,'replay'));
const files=readdirSync(replay).filter(file=>file==='results.json'||/^adb-pull-.+\.json$/.test(file)||file.endsWith('-instrumentation.txt'));
for(const file of files)copyFileSync(resolve(replay,file),resolve(base,'replay',file));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const sources=['LocalUiCapture.kt','PrimaryCaptureColors.kt','PrimaryCaptureColorsTest.kt','NotificationInboxFlowTest.kt','MessagesNotificationRetryFlowTest.kt']
  .map(file=>'android/app/src/androidTest/java/be/sportgreenmoove/app/ui/'+file);
const sourceFiles=Object.fromEntries(sources.map(file=>{
  const bytes=execFileSync('git',['show',run.headSha+':'+file],{cwd:root}),hash=sha(bytes),archive=resolve(root,'docs/release/evidence/source-archive',hash+'.txt');
  if(!existsSync(archive))writeFileSync(archive,bytes,{flag:'wx'});else assert.equal(sha(readFileSync(archive)),hash);return[file,hash];
}));
save('review.json',{scope:'source-specific-notification-capture-correction-full-native-pass-not-release',testedAt:'2026-11-01',
  headSha:run.headSha,workflowId:run.databaseId,mainJobId:124839258714,replayRunId:found[0],sourceFiles,
  sourceSpecificFullGatePassed:true,sourceSpecificAllChecksPassed:true,captureCorrectionVerifiedAtSource:true,
  downloadedArchiveDigestIndependentlyVerified:false,wholeHeadAttested:false,earlierTransportFailuresRepaired:false,
  intermittentTransportCauseProven:false,physicalDeviceAccepted:false,pushDeliveryVerified:false,productionWrites:false,releaseAccepted:false,publishedCaptures:{}});
const retained=readdirSync(base,{recursive:true}).filter(file=>file!=='README.md'&&statSync(resolve(base,file)).isFile());
save('artifact-sha256.json',Object.fromEntries(retained.sort().map(file=>[file,sha(readFileSync(resolve(base,file)))])));
console.log('Retained source-specific complete Native pass; current uncommitted work and physical release remain separate.');
